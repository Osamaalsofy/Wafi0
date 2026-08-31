import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateBranchDto } from './dto/create-branch.dto';
import type { ListBranchesQueryDto } from './dto/list-branches-query.dto';
import type { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListBranchesQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.BranchWhereInput = {
      organizationId: principal.organizationId,
      clientId: query.clientId,
      status: query.status ?? { not: 'ARCHIVED' },
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.branch.findMany({
        where,
        include: { client: { select: { id: true, code: true, name: true } }, governorate: { include: { region: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.branch.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(principal: AuthenticatedPrincipal, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: { client: { select: { id: true, code: true, name: true } }, governorate: { include: { region: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateBranchDto) {
    await this.requireActiveClient(principal.organizationId, input.clientId);
    await this.requireGovernorate(input.governorateId);
    const code = input.code.toUpperCase();
    if (
      await this.prisma.branch.findUnique({
        where: { clientId_code: { clientId: input.clientId, code } },
        select: { id: true },
      })
    )
      throw new ConflictException('Branch code already exists for this client');
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          organizationId: principal.organizationId,
          clientId: input.clientId,
          code,
          name: input.name.trim(),
          address: input.address?.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          governorateId: input.governorateId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Branch',
          entityId: branch.id,
          action: 'branch.created',
          newValues: {
            clientId: branch.clientId,
            code: branch.code,
            name: branch.name,
            status: branch.status,
          },
        },
      });
      return branch;
    });
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateBranchDto) {
    const current = await this.get(principal, id);
    await this.requireGovernorate(input.governorateId);
    if (current.status === 'ARCHIVED')
      throw new ConflictException('Archived branches cannot be updated');
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          address: input.address?.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          governorateId: input.governorateId,
          status: input.status,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Branch',
          entityId: id,
          action: 'branch.updated',
          oldValues: {
            name: current.name,
            address: current.address,
            latitude: current.latitude?.toString(),
            longitude: current.longitude?.toString(),
            status: current.status,
          },
          newValues: {
            name: branch.name,
            address: branch.address,
            latitude: branch.latitude?.toString(),
            longitude: branch.longitude?.toString(),
            status: branch.status,
          },
        },
      });
      return branch;
    });
  }

  async archive(principal: AuthenticatedPrincipal, id: string) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED') return current;
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Branch',
          entityId: id,
          action: 'branch.archived',
          oldValues: { status: current.status },
          newValues: { status: branch.status, archivedAt: branch.archivedAt?.toISOString() },
        },
      });
      return branch;
    });
  }

  private async requireActiveClient(organizationId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Active client not found');
  }

  private async requireGovernorate(governorateId?: string) {
    if (!governorateId) return;
    if (!(await this.prisma.governorate.findFirst({ where: { id: governorateId, isActive: true }, select: { id: true } })))
      throw new NotFoundException('Active governorate not found');
  }
}
