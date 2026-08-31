import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateClientDto } from './dto/create-client.dto';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto';
import type { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListClientsQueryDto) {
    const where: Prisma.ClientWhereInput = {
      organizationId: principal.organizationId,
      status: query.status ?? { not: 'ARCHIVED' },
      ...(query.search?.trim()
        ? {
            OR: [
              { code: { contains: query.search.trim(), mode: 'insensitive' as const } },
              { name: { contains: query.search.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.client.count({ where }),
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
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateClientDto) {
    const code = input.code.toUpperCase();
    const existing = await this.prisma.client.findUnique({
      where: { organizationId_code: { organizationId: principal.organizationId, code } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Client code already exists in this organization');
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId: principal.organizationId,
          code,
          name: input.name.trim(),
          settings: input.settings ?? {},
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Client',
          entityId: client.id,
          action: 'client.created',
          newValues: { code: client.code, name: client.name, status: client.status },
        },
      });
      return client;
    });
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateClientDto) {
    if (!principal.grants.some((grant) => grant.permission === 'client.update' && grant.scopeType === 'ORGANIZATION'))
      throw new ForbiddenException('Client portal access is read-only');
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED')
      throw new ConflictException('Archived clients cannot be updated');
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data: { name: input.name?.trim(), status: input.status, settings: input.settings },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Client',
          entityId: id,
          action: 'client.updated',
          oldValues: { name: current.name, status: current.status, settings: current.settings },
          newValues: { name: client.name, status: client.status, settings: client.settings },
        },
      });
      return client;
    });
  }

  async archive(principal: AuthenticatedPrincipal, id: string) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED') return current;
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Client',
          entityId: id,
          action: 'client.archived',
          oldValues: { status: current.status },
          newValues: { status: client.status, archivedAt: client.archivedAt?.toISOString() },
        },
      });
      return client;
    });
  }
}
