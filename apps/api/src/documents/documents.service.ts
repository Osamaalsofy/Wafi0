import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../environment';
import { DOCUMENT_STORAGE, type DocumentStorage } from './document-storage';
import type { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import type { UploadDocumentDto } from './dto/upload-document.dto';
import type { VerifyDocumentDto } from './dto/verify-document.dto';
import type { RecordMalwareScanDto } from './dto/record-malware-scan.dto';

export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  async list(principal: AuthenticatedPrincipal, query: ListDocumentsQueryDto) {
    const missionAccess = this.missionAccess(principal);
    const where: Prisma.DocumentWhereInput = {
      organizationId: principal.organizationId,
      mission: missionAccess,
      missionId: query.missionId,
      stopId: query.stopId,
      type: query.type,
      verificationStatus: query.verificationStatus,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: this.relations,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.document.count({ where }),
    ]);
    return {
      data: data.map((document) => this.toResponse(document)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(principal: AuthenticatedPrincipal, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId: principal.organizationId, mission: this.missionAccess(principal) },
      include: this.relations,
    });
    if (!document) throw new NotFoundException('Document not found');
    return this.toResponse(document);
  }

  async getContent(principal: AuthenticatedPrincipal, id: string) {
    const document = await this.findDocument(principal, id);
    try {
      const content = await this.storage.get(document.storageKey);
      if (content.length !== document.sizeBytes) {
        throw new InternalServerErrorException('Stored document failed integrity validation');
      }
      if (
        document.checksumSha256 &&
        createHash('sha256').update(content).digest('hex') !== document.checksumSha256
      ) {
        throw new InternalServerErrorException('Stored document checksum validation failed');
      }
      return {
        content,
        mimeType: document.mimeType,
        fileName: document.originalFileName,
        sizeBytes: document.sizeBytes,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException('Stored document is unavailable');
    }
  }

  async upload(
    principal: AuthenticatedPrincipal,
    input: UploadDocumentDto,
    file?: UploadedDocumentFile,
  ) {
    this.validateFile(file);
    await this.requireMissionAndStop(principal, input.missionId, input.stopId);
    const replaced = input.replacesDocumentId
      ? await this.prisma.document.findFirst({
          where: {
            id: input.replacesDocumentId,
            organizationId: principal.organizationId,
            missionId: input.missionId,
          },
        })
      : null;
    if (input.replacesDocumentId && !replaced)
      throw new NotFoundException('Replacement source document not found');
    if (replaced && (replaced.type !== input.type || replaced.stopId !== (input.stopId ?? null)))
      throw new BadRequestException('Replacement must preserve document type and stop scope');

    const extension = this.extensionFor(file.mimetype);
    const storageKey = `${principal.organizationId}/${input.missionId}/${randomUUID()}${extension}`;
    const checksumSha256 = createHash('sha256').update(file.buffer).digest('hex');
    await this.storage.put({ key: storageKey, content: file.buffer, contentType: file.mimetype });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            organizationId: principal.organizationId,
            missionId: input.missionId,
            stopId: input.stopId,
            type: input.type,
            storageKey,
            originalFileName: file.originalname.slice(0, 255),
            mimeType: file.mimetype,
            sizeBytes: file.size,
            checksumSha256,
            version: replaced ? replaced.version + 1 : 1,
            replacesDocumentId: replaced?.id,
            retentionUntil: new Date(Date.UTC(new Date().getUTCFullYear() + 7, 11, 31)),
            malwareScanStatus: 'PENDING',
            uploadedByUserId: principal.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: principal.organizationId,
            actorUserId: principal.userId,
            entityType: 'Document',
            entityId: document.id,
            action: 'document.uploaded',
            newValues: {
              missionId: document.missionId,
              stopId: document.stopId,
              type: document.type,
              storageKey,
              mimeType: document.mimeType,
              sizeBytes: document.sizeBytes,
              checksumSha256,
              version: document.version,
              replacesDocumentId: document.replacesDocumentId,
              malwareScanStatus: document.malwareScanStatus,
            },
          },
        });
        return this.toResponse(document);
      });
    } catch (error) {
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  async verify(principal: AuthenticatedPrincipal, id: string, input: VerifyDocumentDto) {
    if (input.status === 'PENDING')
      throw new BadRequestException('Verification status must be VERIFIED or REJECTED');
    const notes = input.notes?.trim();
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `DOCUMENT_VERIFICATION:${principal.organizationId}:${id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const current = await tx.document.findFirst({
        where: { id, organizationId: principal.organizationId },
        include: this.relations,
      });
      if (!current) throw new NotFoundException('Document not found');
      if (current.uploadedByUserId === principal.userId) {
        throw new BadRequestException('A document uploader cannot verify the same document');
      }
      if (current.malwareScanStatus !== 'CLEAN') {
        throw new BadRequestException('Document must pass malware scanning before verification');
      }
      if (current.verificationStatus === input.status && current.verificationNotes === notes) {
        return this.toResponse(current);
      }
      const document = await tx.document.update({
        where: { id },
        data: {
          verificationStatus: input.status,
          verificationNotes: notes,
          verifiedByUserId: principal.userId,
          verifiedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Document',
          entityId: id,
          action: 'document.verification_changed',
          oldValues: { status: current.verificationStatus, notes: current.verificationNotes },
          newValues: {
            status: document.verificationStatus,
            notes: document.verificationNotes,
            verifiedByUserId: document.verifiedByUserId,
            verifiedAt: document.verifiedAt?.toISOString(),
          },
        },
      });
      return this.toResponse(document);
    });
  }

  async recordMalwareScan(
    principal: AuthenticatedPrincipal,
    id: string,
    input: RecordMalwareScanDto,
  ) {
    if (input.status === 'PENDING')
      throw new BadRequestException('A completed malware scan status is required');
    const current = await this.findDocument(principal, id);
    const malwareScannedAt = new Date();
    const document = await this.prisma.document.update({
      where: { id: current.id },
      data: { malwareScanStatus: input.status, malwareScannedAt },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        entityType: 'Document',
        entityId: id,
        action: 'document.malware_scan_recorded',
        newValues: {
          status: input.status,
          detail: input.detail?.trim() ?? null,
          malwareScannedAt: malwareScannedAt.toISOString(),
        },
      },
    });
    return this.toResponse(document);
  }

  private validateFile(file?: UploadedDocumentFile): asserts file is UploadedDocumentFile {
    if (!file?.buffer.length || file.size < 1)
      throw new BadRequestException('A non-empty document file is required');
    if (file.size !== file.buffer.length)
      throw new BadRequestException('Document size metadata does not match its content');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype))
      throw new BadRequestException('Only PDF, JPEG, and PNG documents are allowed');
    const maxSize = this.config.get('DOCUMENT_MAX_SIZE_BYTES', { infer: true });
    if (file.size > maxSize)
      throw new BadRequestException(`Document exceeds the ${maxSize} byte limit`);
    if (!this.hasExpectedSignature(file.mimetype, file.buffer))
      throw new BadRequestException('Document content does not match its declared file type');
    if (
      !file.originalname.trim() ||
      [...file.originalname].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      })
    )
      throw new BadRequestException('Document filename is invalid');
  }

  private missionAccess(principal: AuthenticatedPrincipal): Prisma.MissionWhereInput | undefined {
    const grants = principal.grants.filter((grant) => grant.permission === 'document.read');
    if (grants.some((grant) => grant.scopeType === 'ORGANIZATION')) return undefined;
    const clientIds = grants.filter((grant) => grant.scopeType === 'CLIENT').map((grant) => grant.scopeId);
    if (clientIds.length) return { clientId: { in: clientIds } };
    return { driver: { userId: principal.userId } };
  }

  private async requireMissionAndStop(principal: AuthenticatedPrincipal, missionId: string, stopId?: string) {
    const mission = await this.prisma.mission.findFirst({
      where: { id: missionId, organizationId: principal.organizationId, ...this.missionAccess(principal) },
      select: { id: true },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    if (
      stopId &&
      !(await this.prisma.missionStop.findFirst({
        where: { id: stopId, missionId, organizationId: principal.organizationId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Mission stop not found');
    }
  }

  private extensionFor(mimeType: string) {
    return mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : '.jpg';
  }

  private hasExpectedSignature(mimeType: string, content: Buffer) {
    if (mimeType === 'application/pdf') return content.subarray(0, 5).toString() === '%PDF-';
    if (mimeType === 'image/png')
      return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  }

  private async findDocument(principal: AuthenticatedPrincipal, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId: principal.organizationId, mission: this.missionAccess(principal) },
      include: this.relations,
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  private toResponse<T extends { storageKey: string }>(document: T): Omit<T, 'storageKey'> {
    const { storageKey: _storageKey, ...response } = document;
    void _storageKey;
    return response;
  }

  private readonly relations = {
    mission: { select: { id: true, missionNo: true } },
    stop: { select: { id: true, sequence: true } },
    uploadedBy: { select: { id: true, name: true } },
    verifiedBy: { select: { id: true, name: true } },
  } as const;
}
