import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListVehiclesQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.VehicleWhereInput = {
      organizationId: principal.organizationId,
      carrierId: query.carrierId,
      status: query.status ?? { not: 'ARCHIVED' },
      ...(search
        ? {
            OR: [
              { plateNo: { contains: search, mode: 'insensitive' as const } },
              { vehicleType: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        include: { carrier: { select: { id: true, code: true, name: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.vehicle.count({ where }),
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
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: { carrier: { select: { id: true, code: true, name: true } } },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateVehicleDto) {
    await this.requireActiveCarrier(principal.organizationId, input.carrierId);
    this.validateCapacity(input.capacity, input.capacityUnit);
    const plateNo = input.plateNo.trim().toUpperCase();
    if (
      await this.prisma.vehicle.findUnique({
        where: { carrierId_plateNo: { carrierId: input.carrierId, plateNo } },
        select: { id: true },
      })
    )
      throw new ConflictException('Vehicle plate number already exists for this carrier');
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          organizationId: principal.organizationId,
          carrierId: input.carrierId,
          plateNo,
          vehicleType: input.vehicleType?.trim(),
          capacity: input.capacity,
          capacityUnit: input.capacityUnit?.trim(),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Vehicle',
          entityId: vehicle.id,
          action: 'vehicle.created',
          newValues: {
            carrierId: vehicle.carrierId,
            plateNo: vehicle.plateNo,
            vehicleType: vehicle.vehicleType,
            capacity: vehicle.capacity?.toString(),
            capacityUnit: vehicle.capacityUnit,
            status: vehicle.status,
          },
        },
      });
      return vehicle;
    });
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateVehicleDto) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED')
      throw new ConflictException('Archived vehicles cannot be updated');
    const nextCapacity = input.capacity ?? current.capacity?.toNumber();
    const nextUnit = input.capacityUnit ?? current.capacityUnit ?? undefined;
    this.validateCapacity(nextCapacity, nextUnit);
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.update({
        where: { id },
        data: {
          vehicleType: input.vehicleType?.trim(),
          capacity: input.capacity,
          capacityUnit: input.capacityUnit?.trim(),
          status: input.status,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Vehicle',
          entityId: id,
          action: 'vehicle.updated',
          oldValues: {
            vehicleType: current.vehicleType,
            capacity: current.capacity?.toString(),
            capacityUnit: current.capacityUnit,
            status: current.status,
          },
          newValues: {
            vehicleType: vehicle.vehicleType,
            capacity: vehicle.capacity?.toString(),
            capacityUnit: vehicle.capacityUnit,
            status: vehicle.status,
          },
        },
      });
      return vehicle;
    });
  }

  async archive(principal: AuthenticatedPrincipal, id: string) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED') return current;
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Vehicle',
          entityId: id,
          action: 'vehicle.archived',
          oldValues: { status: current.status },
          newValues: { status: vehicle.status, archivedAt: vehicle.archivedAt?.toISOString() },
        },
      });
      return vehicle;
    });
  }

  private validateCapacity(capacity?: number, unit?: string) {
    if ((capacity === undefined) !== (unit === undefined))
      throw new ConflictException('Capacity and capacity unit must be provided together');
  }

  private async requireActiveCarrier(organizationId: string, carrierId: string) {
    if (
      !(await this.prisma.carrier.findFirst({
        where: { id: carrierId, organizationId, status: 'ACTIVE' },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Active carrier not found');
  }
}
