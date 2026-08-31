import { Injectable } from '@nestjs/common';
import type {
  ClosureStage,
  MissionStatus,
  MissionStopStatus,
  Prisma,
} from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { evaluateDocumentRequirements } from '../closure-policies/closure-requirements.service';
import { PrismaService } from '../database/prisma.service';
import type { ControlTowerQueryDto } from './dto/control-tower-query.dto';

const TERMINAL_STATUSES: MissionStatus[] = ['CLOSED', 'CANCELLED'];

@Injectable()
export class ControlTowerService {
  constructor(private readonly prisma: PrismaService) {}

  async get(principal: AuthenticatedPrincipal, query: ControlTowerQueryDto) {
    const search = query.search?.trim();
    const scopedClientIds = this.allowedClientIds(principal);
    const where: Prisma.MissionWhereInput = {
      organizationId: principal.organizationId,
      status: query.status ?? { notIn: TERMINAL_STATUSES },
      clientId: scopedClientIds ? (query.clientId ? (scopedClientIds.includes(query.clientId) ? query.clientId : '__denied__') : { in: scopedClientIds }) : query.clientId,
      warehouseId: query.warehouseId,
      carrierId: query.carrierId,
      ...(search
        ? {
            OR: [
              { missionNo: { contains: search, mode: 'insensitive' as const } },
              { cargoType: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [
      missions,
      total,
      grouped,
      clients,
      warehouses,
      carriers,
      drivers,
      openExceptions,
      criticalExceptions,
    ] = await this.prisma.$transaction([
      this.prisma.mission.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              code: true,
              name: true,
              closurePolicies: {
                where: { isActive: true },
                select: {
                  stage: true,
                  requirements: { select: { documentType: true, scope: true } },
                },
              },
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              latitude: true,
              longitude: true,
            },
          },
          carrier: { select: { id: true, code: true, name: true } },
          vehicle: { select: { id: true, plateNo: true } },
          driver: { select: { id: true, name: true, trackingNumber: true } },
          route: { select: { id: true, code: true, name: true, cityRegion: true, timeZone: true } },
          stops: {
            select: {
              id: true,
              sequence: true,
              status: true,
              expectedArrival: true,
              branch: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  address: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
            orderBy: { sequence: 'asc' },
          },
          documents: {
            where: { verificationStatus: 'VERIFIED' },
            select: { type: true, stopId: true },
          },
          exceptions: {
            where: { status: { not: 'RESOLVED' } },
            select: {
              id: true,
              ruleCode: true,
              severity: true,
              status: true,
              isBlocking: true,
              openedAt: true,
              lastDetectedAt: true,
              definition: { select: { name: true } },
              stop: {
                select: { branch: { select: { id: true, code: true, name: true } } },
              },
            },
            orderBy: { lastDetectedAt: 'desc' },
          },
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ updatedAt: 'desc' }, { missionNo: 'asc' }],
      }),
      this.prisma.mission.count({ where }),
      this.prisma.mission.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.client.findMany({
        where: { organizationId: principal.organizationId, status: 'ACTIVE', id: scopedClientIds ? { in: scopedClientIds } : undefined },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.findMany({
        where: { organizationId: principal.organizationId, status: 'ACTIVE', clientId: scopedClientIds ? { in: scopedClientIds } : undefined },
        select: { id: true, clientId: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.carrier.findMany({
        where: {
          organizationId: principal.organizationId,
          status: 'ACTIVE',
          missions: scopedClientIds ? { some: { clientId: { in: scopedClientIds } } } : undefined,
        },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.driver.findMany({
        where: { organizationId: principal.organizationId, status: 'ACTIVE', clientId: scopedClientIds ? { in: scopedClientIds } : { not: null } },
        select: {
          id: true,
          clientId: true,
          name: true,
          profilePhotoDocumentId: true,
          _count: { select: { missions: true } },
          client: { select: { id: true, name: true } },
          carrier: { select: { id: true, code: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.operationalException.count({
        where: {
          organizationId: principal.organizationId,
          status: { not: 'RESOLVED' },
          mission: where,
        },
      }),
      this.prisma.operationalException.count({
        where: {
          organizationId: principal.organizationId,
          status: { not: 'RESOLVED' },
          severity: 'CRITICAL',
          mission: where,
        },
      }),
    ]);

    const byStatus = this.emptyStatusCounts();
    for (const group of grouped) byStatus[group.status] = group._count._all;
    const data = missions.map(({ stops, documents, client, exceptions, ...mission }) => {
      const closureReadiness = this.closureReadiness(
        mission.status,
        client.closurePolicies,
        stops,
        documents,
      );
      return {
        ...mission,
        client: { id: client.id, code: client.code, name: client.name },
        openExceptions: exceptions.map(({ openedAt, ...exception }) => ({
          ...exception,
          firstDetectedAt: openedAt,
        })),
        mapStops: stops.map(({ branch, ...stop }) => ({ ...stop, branch })),
        stopProgress: this.stopProgress(stops),
        closureReadiness,
      };
    });

    return {
      summary: {
        totalActive: total,
        byStatus,
        pageRequiringDocumentAttention: data.filter(
          ({ closureReadiness }) => closureReadiness.applicable && !closureReadiness.ready,
        ).length,
        openExceptions,
        criticalExceptions,
        delayEvaluation: {
          available: true,
          reason: 'Evaluated only when an effective rule definition supplies a threshold',
        },
      },
      filterOptions: { clients, warehouses, carriers, drivers },
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private allowedClientIds(principal: AuthenticatedPrincipal) {
    const grants = principal.grants.filter((grant) => grant.permission === 'control_tower.read');
    if (grants.some((grant) => grant.scopeType === 'ORGANIZATION')) return undefined;
    const ids = grants.filter((grant) => grant.scopeType === 'CLIENT').map((grant) => grant.scopeId);
    return ids;
  }

  private closureReadiness(
    status: MissionStatus,
    policies: Array<{
      stage: ClosureStage;
      requirements: Array<{
        documentType: Parameters<typeof evaluateDocumentRequirements>[0][number]['documentType'];
        scope: Parameters<typeof evaluateDocumentRequirements>[0][number]['scope'];
      }>;
    }>,
    stops: Array<{ id: string }>,
    documents: Parameters<typeof evaluateDocumentRequirements>[2],
  ) {
    const stage: ClosureStage | undefined =
      status === 'DELIVERED'
        ? 'OPERATIONAL_CLOSURE'
        : status === 'OPERATIONALLY_CLOSED'
          ? 'ACCOUNTING_READINESS'
          : undefined;
    if (!stage) return { applicable: false as const };
    const policy = policies.find((candidate) => candidate.stage === stage);
    if (!policy)
      return {
        applicable: true as const,
        stage,
        policyConfigured: false,
        ready: false,
        missing: [],
      };
    const missing = evaluateDocumentRequirements(policy.requirements, stops, documents);
    return {
      applicable: true as const,
      stage,
      policyConfigured: true,
      ready: missing.length === 0,
      missing,
    };
  }

  private stopProgress(stops: Array<{ status: MissionStopStatus }>) {
    return {
      total: stops.length,
      pending: stops.filter(({ status }) => status === 'PENDING').length,
      arrived: stops.filter(({ status }) => status === 'ARRIVED').length,
      unloading: stops.filter(({ status }) => status === 'UNLOADING').length,
      completed: stops.filter(({ status }) => status === 'COMPLETED').length,
      cancelled: stops.filter(({ status }) => status === 'CANCELLED').length,
    };
  }

  private emptyStatusCounts(): Record<MissionStatus, number> {
    return {
      DRAFT: 0,
      ASSIGNED: 0,
      WAITING_FOR_VEHICLE: 0,
      VEHICLE_ARRIVED: 0,
      LOADING: 0,
      LOADED: 0,
      DEPARTED: 0,
      IN_TRANSIT: 0,
      AT_STOP: 0,
      DELIVERING: 0,
      DELIVERED: 0,
      OPERATIONALLY_CLOSED: 0,
      ACCOUNTING_READY: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };
  }
}
