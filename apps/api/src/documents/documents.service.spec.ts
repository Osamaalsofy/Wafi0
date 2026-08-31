import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../environment';
import type { DocumentStorage } from './document-storage';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  const prisma = {} as never;
  const put = jest.fn();
  const deleteObject = jest.fn();
  const storage: DocumentStorage = { put, get: jest.fn(), delete: deleteObject };
  const config = new ConfigService<Environment, true>({ DOCUMENT_MAX_SIZE_BYTES: 10 });
  const service = new DocumentsService(prisma, config, storage);

  it('uses a stable unique tie-breaker for paginated documents', async () => {
    let documentOrder: Array<Record<string, string>> | undefined;
    const listPrisma = {
      document: {
        findMany: jest.fn((input: { orderBy: Array<Record<string, string>> }) => {
          documentOrder = input.orderBy;
          return 'documents';
        }),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as never;

    await new DocumentsService(listPrisma, config, storage).list(
      { userId: 'user', organizationId: 'organization', email: 'test@example.com', grants: [] },
      { page: 1, limit: 25 },
    );

    expect(documentOrder).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('rejects unsupported file types before persistence', async () => {
    await expect(
      service.upload(
        { userId: 'user', organizationId: 'organization', email: 'test@example.com', grants: [] },
        { missionId: 'mission', type: 'OTHER' },
        {
          originalname: 'payload.exe',
          mimetype: 'application/octet-stream',
          size: 4,
          buffer: Buffer.from('test'),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects files above the configured limit before persistence', async () => {
    await expect(
      service.upload(
        { userId: 'user', organizationId: 'organization', email: 'test@example.com', grants: [] },
        { missionId: 'mission', type: 'OTHER' },
        {
          originalname: 'large.pdf',
          mimetype: 'application/pdf',
          size: 11,
          buffer: Buffer.alloc(11),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(put).not.toHaveBeenCalled();
  });

  it('does not allow PENDING as a verification command', async () => {
    await expect(
      service.verify(
        { userId: 'user', organizationId: 'organization', email: 'test@example.com', grants: [] },
        'document',
        { status: 'PENDING' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks and rereads a document before changing verification state', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findDocument = jest.fn().mockResolvedValue({
      id: 'document-id',
      organizationId: 'organization',
      storageKey: 'organization/mission/document.pdf',
      verificationStatus: 'PENDING',
      verificationNotes: null,
      uploadedByUserId: 'uploader',
      malwareScanStatus: 'CLEAN',
    });
    const updateDocument = jest.fn().mockResolvedValue({
      id: 'document-id',
      storageKey: 'organization/mission/document.pdf',
      verificationStatus: 'VERIFIED',
      verificationNotes: 'Checked',
      verifiedByUserId: 'user',
      verifiedAt: new Date('2026-08-12T10:00:00Z'),
    });
    const tx = {
      $executeRaw: queryRaw,
      document: { findFirst: findDocument, update: updateDocument },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const verifyPrisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as import('../database/prisma.service').PrismaService;

    await new DocumentsService(verifyPrisma, config, storage).verify(
      { userId: 'user', organizationId: 'organization', email: 'test@example.com', grants: [] },
      'document-id',
      { status: 'VERIFIED', notes: 'Checked' },
    );

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findDocument.mock.invocationCallOrder[0],
    );
    expect(findDocument).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'document-id', organizationId: 'organization' } }),
    );
    expect(updateDocument).toHaveBeenCalledTimes(1);
  });

  it('prevents an uploader from verifying the same document', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      document: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'document-id',
          organizationId: 'organization',
          uploadedByUserId: 'user',
          verificationStatus: 'PENDING',
          verificationNotes: null,
        }),
      },
    };
    const verifyPrisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as import('../database/prisma.service').PrismaService;
    await expect(
      new DocumentsService(verifyPrisma, config, storage).verify(
        { userId: 'user', organizationId: 'organization', email: 'test@example.com', grants: [] },
        'document-id',
        { status: 'VERIFIED' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects content whose signature does not match its declared type', async () => {
    await expect(
      service.upload(
        { userId: 'user', organizationId: 'organization', email: 'test@example.com', grants: [] },
        { missionId: 'mission', type: 'POD' },
        {
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          size: 4,
          buffer: Buffer.from('test'),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(put).not.toHaveBeenCalled();
  });
});
jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));
