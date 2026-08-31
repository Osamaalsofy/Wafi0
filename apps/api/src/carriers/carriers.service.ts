import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateCarrierDto } from './dto/create-carrier.dto';
import type { ListCarriersQueryDto } from './dto/list-carriers-query.dto';
import type { UpdateCarrierDto } from './dto/update-carrier.dto';

@Injectable()
export class CarriersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListCarriersQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.CarrierWhereInput = {
      organizationId: principal.organizationId,
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
      this.prisma.carrier.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.carrier.count({ where }),
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
    const carrier = await this.prisma.carrier.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!carrier) throw new NotFoundException('Carrier not found');
    return carrier;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateCarrierDto) {
    const code = input.code.toUpperCase();
    const existing = await this.prisma.carrier.findUnique({
      where: { organizationId_code: { organizationId: principal.organizationId, code } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Carrier code already exists in this organization');
    return this.prisma.$transaction(async (tx) => {
      const carrier = await tx.carrier.create({
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
          entityType: 'Carrier',
          entityId: carrier.id,
          action: 'carrier.created',
          newValues: { code: carrier.code, name: carrier.name, status: carrier.status },
        },
      });
      return carrier;
    });
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateCarrierDto) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED')
      throw new ConflictException('Archived carriers cannot be updated');
    return this.prisma.$transaction(async (tx) => {
      const carrier = await tx.carrier.update({
        where: { id },
        data: { name: input.name?.trim(), status: input.status, settings: input.settings },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Carrier',
          entityId: id,
          action: 'carrier.updated',
          oldValues: { name: current.name, status: current.status, settings: current.settings },
          newValues: { name: carrier.name, status: carrier.status, settings: carrier.settings },
        },
      });
      return carrier;
    });
  }

  async archive(principal: AuthenticatedPrincipal, id: string) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED') return current;
    return this.prisma.$transaction(async (tx) => {
      const carrier = await tx.carrier.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Carrier',
          entityId: id,
          action: 'carrier.archived',
          oldValues: { status: current.status },
          newValues: { status: carrier.status, archivedAt: carrier.archivedAt?.toISOString() },
        },
      });
      return carrier;
    });
  }
}
