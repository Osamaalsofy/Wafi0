import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateRouteDto } from './dto/create-route.dto';
import type { ListRoutesQueryDto } from './dto/list-routes-query.dto';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListRoutesQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.OperationalRouteWhereInput = {
      organizationId: principal.organizationId,
      clientId: query.clientId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
              { cityRegion: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.operationalRoute.findMany({
        where,
        include: {
          client: { select: { id: true, code: true, name: true } },
          stops: {
            orderBy: { sequence: 'asc' },
            include: { branch: { select: { id: true, code: true, name: true } } },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.operationalRoute.count({ where }),
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
    const route = await this.prisma.operationalRoute.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: {
        client: { select: { id: true, code: true, name: true } },
        stops: {
          orderBy: { sequence: 'asc' },
          include: { branch: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!route) throw new NotFoundException('Operational route not found');
    return route;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateRouteDto) {
    const timeZone = input.timeZone.trim();
    this.validateTimeZone(timeZone);
    const code = input.code.toUpperCase();
    const sequences = input.stops.map(({ sequence }) => sequence);
    if (new Set(sequences).size !== sequences.length) {
      throw new ConflictException('Route stop sequences must be unique');
    }
    if (
      await this.prisma.operationalRoute.findUnique({
        where: { organizationId_code: { organizationId: principal.organizationId, code } },
        select: { id: true },
      })
    ) {
      throw new ConflictException('Route code already exists in this organization');
    }
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, organizationId: principal.organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Active route client not found');
    const branchIds = [...new Set(input.stops.map(({ branchId }) => branchId))];
    const branches = await this.prisma.branch.findMany({
      where: {
        id: { in: branchIds },
        organizationId: principal.organizationId,
        clientId: input.clientId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (branches.length !== branchIds.length) {
      throw new NotFoundException(
        'Every route stop must reference an active branch for the client',
      );
    }

    const stops = [...input.stops].sort((left, right) => left.sequence - right.sequence);
    return this.prisma.$transaction(async (tx) => {
      const route = await tx.operationalRoute.create({
        data: {
          organizationId: principal.organizationId,
          clientId: input.clientId,
          code,
          name: input.name.trim(),
          cityRegion: input.cityRegion.trim(),
          timeZone,
          createdByUserId: principal.userId,
          stops: { create: stops.map(({ branchId, sequence }) => ({ branchId, sequence })) },
        },
        include: { stops: { orderBy: { sequence: 'asc' } } },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'OperationalRoute',
          entityId: route.id,
          action: 'route.created',
          newValues: {
            clientId: route.clientId,
            code: route.code,
            name: route.name,
            cityRegion: route.cityRegion,
            timeZone: route.timeZone,
            status: route.status,
            stops: stops.map(({ branchId, sequence }) => ({ branchId, sequence })),
          },
        },
      });
      return route;
    });
  }

  private validateTimeZone(timeZone: string) {
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
    } catch {
      throw new ConflictException('timeZone must be a valid IANA time-zone identifier');
    }
    if (timeZone !== 'Asia/Riyadh') {
      throw new ConflictException('Saudi operational routes must use Asia/Riyadh');
    }
  }
}
