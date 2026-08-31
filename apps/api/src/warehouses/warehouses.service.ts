import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto';
import type { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import type { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListWarehousesQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.WarehouseWhereInput = {
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
      this.prisma.warehouse.findMany({
        where,
        include: { client: { select: { id: true, code: true, name: true } }, governorate: { include: { region: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.warehouse.count({ where }),
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
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: { client: { select: { id: true, code: true, name: true } }, governorate: { include: { region: true } } },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateWarehouseDto) {
    await this.requireActiveClient(principal.organizationId, input.clientId);
    await this.requireGovernorate(input.governorateId);
    const code = input.code.toUpperCase();
    if (
      await this.prisma.warehouse.findUnique({
        where: { clientId_code: { clientId: input.clientId, code } },
        select: { id: true },
      })
    )
      throw new ConflictException('Warehouse code already exists for this client');
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({
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
          entityType: 'Warehouse',
          entityId: warehouse.id,
          action: 'warehouse.created',
          newValues: {
            clientId: warehouse.clientId,
            code: warehouse.code,
            name: warehouse.name,
            status: warehouse.status,
          },
        },
      });
      return warehouse;
    });
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateWarehouseDto) {
    const current = await this.get(principal, id);
    await this.requireGovernorate(input.governorateId);
    if (current.status === 'ARCHIVED')
      throw new ConflictException('Archived warehouses cannot be updated');
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.update({
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
          entityType: 'Warehouse',
          entityId: id,
          action: 'warehouse.updated',
          oldValues: {
            name: current.name,
            address: current.address,
            latitude: current.latitude?.toString(),
            longitude: current.longitude?.toString(),
            status: current.status,
          },
          newValues: {
            name: warehouse.name,
            address: warehouse.address,
            latitude: warehouse.latitude?.toString(),
            longitude: warehouse.longitude?.toString(),
            status: warehouse.status,
          },
        },
      });
      return warehouse;
    });
  }

  async archive(principal: AuthenticatedPrincipal, id: string) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED') return current;
    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Warehouse',
          entityId: id,
          action: 'warehouse.archived',
          oldValues: { status: current.status },
          newValues: { status: warehouse.status, archivedAt: warehouse.archivedAt?.toISOString() },
        },
      });
      return warehouse;
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
