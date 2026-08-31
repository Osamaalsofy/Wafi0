import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateDriverDto } from './dto/create-driver.dto';
import type { ListDriversQueryDto } from './dto/list-drivers-query.dto';
import type { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListDriversQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.DriverWhereInput = {
      organizationId: principal.organizationId,
      carrierId: query.carrierId,
      status: query.status ?? { not: 'ARCHIVED' },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { licenseNo: { contains: search, mode: 'insensitive' as const } },
              { trackingNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        include: { carrier: { select: { id: true, code: true, name: true } }, client: { select: { id: true, code: true, name: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.driver.count({ where }),
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
    const driver = await this.prisma.driver.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: { carrier: { select: { id: true, code: true, name: true } }, client: { select: { id: true, code: true, name: true } } },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateDriverDto) {
    await this.requireActiveCarrier(principal.organizationId, input.carrierId);
    await this.requireActiveClient(principal.organizationId, input.clientId);
    const licenseNo = input.licenseNo?.trim().toUpperCase();
    const trackingNumber = input.trackingNumber?.trim().toUpperCase();
    await this.requireUniqueTrackingNumber(principal.organizationId, trackingNumber);
    if (
      licenseNo &&
      (await this.prisma.driver.findUnique({
        where: { carrierId_licenseNo: { carrierId: input.carrierId, licenseNo } },
        select: { id: true },
      }))
    )
      throw new ConflictException('Driver license number already exists for this carrier');
    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.create({
        data: {
          organizationId: principal.organizationId,
          carrierId: input.carrierId,
          clientId: input.clientId,
          trackingNumber,
          name: input.name.trim(),
          phone: input.phone?.trim(),
          licenseNo,
          nationalId: input.nationalId?.trim(),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Driver',
          entityId: driver.id,
          action: 'driver.created',
          newValues: {
            carrierId: driver.carrierId,
            clientId: driver.clientId,
            trackingNumber: driver.trackingNumber,
            name: driver.name,
            licenseNo: driver.licenseNo,
            status: driver.status,
          },
        },
      });
      return driver;
    });
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateDriverDto) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED')
      throw new ConflictException('Archived drivers cannot be updated');
    const licenseNo = input.licenseNo?.trim().toUpperCase();
    const trackingNumber = input.trackingNumber?.trim().toUpperCase();
    await this.requireActiveClient(principal.organizationId, input.clientId);
    await this.requireUniqueTrackingNumber(principal.organizationId, trackingNumber, id);
    if (licenseNo) {
      const duplicate = await this.prisma.driver.findUnique({
        where: { carrierId_licenseNo: { carrierId: current.carrierId, licenseNo } },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException('Driver license number already exists for this carrier');
    }
    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          clientId: input.clientId,
          trackingNumber,
          phone: input.phone?.trim(),
          licenseNo,
          nationalId: input.nationalId?.trim(),
          status: input.status,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Driver',
          entityId: id,
          action: 'driver.updated',
          oldValues: {
            name: current.name,
            phone: current.phone,
            licenseNo: current.licenseNo,
            clientId: current.clientId,
            trackingNumber: current.trackingNumber,
            status: current.status,
          },
          newValues: {
            name: driver.name,
            phone: driver.phone,
            licenseNo: driver.licenseNo,
            clientId: driver.clientId,
            trackingNumber: driver.trackingNumber,
            status: driver.status,
          },
        },
      });
      return driver;
    });
  }

  async archive(principal: AuthenticatedPrincipal, id: string) {
    const current = await this.get(principal, id);
    if (current.status === 'ARCHIVED') return current;
    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.update({
        where: { id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Driver',
          entityId: id,
          action: 'driver.archived',
          oldValues: { status: current.status },
          newValues: { status: driver.status, archivedAt: driver.archivedAt?.toISOString() },
        },
      });
      return driver;
    });
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

  private async requireActiveClient(organizationId: string, clientId?: string) {
    if (!clientId) return;
    if (!(await this.prisma.client.findFirst({ where: { id: clientId, organizationId, status: 'ACTIVE' }, select: { id: true } })))
      throw new NotFoundException('Active client not found');
  }

  private async requireUniqueTrackingNumber(organizationId: string, trackingNumber?: string, driverId?: string) {
    if (!trackingNumber) return;
    const duplicate = await this.prisma.driver.findUnique({
      where: { organizationId_trackingNumber: { organizationId, trackingNumber } },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== driverId)
      throw new ConflictException('Driver tracking number already exists in this organization');
  }
}
