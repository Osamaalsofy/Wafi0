import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma, RuleScopeType } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateKpiFactSnapshotDto } from './dto/create-kpi-fact-snapshot.dto';

@Injectable()
export class KpiFactSnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(principal: AuthenticatedPrincipal, id: string) {
    const snapshot = await this.prisma.kpiFactSnapshot.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: {
        configuration: { include: { definition: true } },
        missionFacts: { orderBy: { missionId: 'asc' } },
      },
    });
    if (!snapshot) throw new NotFoundException('KPI fact snapshot not found');
    return snapshot;
  }

  create(principal: AuthenticatedPrincipal, input: CreateKpiFactSnapshotDto) {
    this.validateTimeZone(input.timeZone);
    const sourceCutoffAt = new Date(input.sourceCutoffAt);
    const periodDate = new Date(`${input.periodDate}T00:00:00.000Z`);
    if (Number.isNaN(periodDate.getTime())) throw new ConflictException('Invalid periodDate');
    const missionIds = [...input.missionIds].sort();
    const missionSetHash = createHash('sha256').update(JSON.stringify(missionIds)).digest('hex');

    return this.prisma.$transaction(
      async (tx) => {
        const lockKey = `KPI_FACT_SNAPSHOT:${principal.organizationId}:${input.idempotencyKey}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const existing = await tx.kpiFactSnapshot.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: principal.organizationId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { missionFacts: { orderBy: { missionId: 'asc' } } },
        });
        if (existing) {
          if (
            existing.configurationId !== input.configurationId ||
            existing.periodDate.getTime() !== periodDate.getTime() ||
            existing.timeZone !== input.timeZone ||
            existing.sourceCutoffAt.getTime() !== sourceCutoffAt.getTime() ||
            existing.missionSetHash !== missionSetHash
          ) {
            throw new ConflictException('KPI snapshot idempotency key was already used');
          }
          return existing;
        }

        const configuration = await tx.kpiConfiguration.findFirst({
          where: {
            id: input.configurationId,
            organizationId: principal.organizationId,
            calculationFrequency: 'DAILY',
            createdAt: { lte: sourceCutoffAt },
            effectiveFrom: { lte: sourceCutoffAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: sourceCutoffAt } }],
          },
        });
        if (!configuration)
          throw new NotFoundException('Effective daily KPI configuration not found');

        const missions = await tx.mission.findMany({
          where: { id: { in: missionIds }, organizationId: principal.organizationId },
          orderBy: { id: 'asc' },
          include: {
            route: { select: { timeZone: true } },
            contract: { select: { temperatureMonitoringRequired: true } },
            stops: {
              orderBy: { sequence: 'asc' },
              select: {
                id: true,
                status: true,
                expectedArrival: true,
                actualArrival: true,
              },
            },
            documents: {
              where: { createdAt: { lte: sourceCutoffAt } },
              select: { type: true, verificationStatus: true, stopId: true },
            },
            events: {
              where: { occurredAt: { lte: sourceCutoffAt } },
              orderBy: { occurredAt: 'asc' },
              select: { eventType: true, occurredAt: true },
            },
            exceptions: {
              where: { openedAt: { lte: sourceCutoffAt } },
              orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                ruleCode: true,
                stopId: true,
                severity: true,
                openedAt: true,
                lastDetectedAt: true,
                resolvedAt: true,
                updatedAt: true,
                delayMinutes: true,
                actualQuantity: true,
                toleranceQuantity: true,
              },
            },
          },
        });
        if (missions.length !== missionIds.length) {
          throw new NotFoundException('One or more tenant missions were not found');
        }
        for (const mission of missions) {
          if (mission.updatedAt > sourceCutoffAt) {
            throw new ConflictException('Mission state changed after the KPI source cutoff');
          }
          if (
            mission.exceptions.some(
              (exception) =>
                exception.updatedAt > sourceCutoffAt ||
                exception.lastDetectedAt > sourceCutoffAt ||
                (exception.resolvedAt !== null && exception.resolvedAt > sourceCutoffAt),
            )
          ) {
            throw new ConflictException('Exception facts changed after the KPI source cutoff');
          }
          if (!this.matchesScope(configuration.scopeType, configuration.scopeId, mission)) {
            throw new NotFoundException('Mission is outside the KPI configuration scope');
          }
          if (mission.route && mission.route.timeZone !== input.timeZone) {
            throw new ConflictException(
              'Snapshot timezone must match every mission route timezone',
            );
          }
        }

        const snapshot = await tx.kpiFactSnapshot.create({
          data: {
            organizationId: principal.organizationId,
            configurationId: configuration.id,
            idempotencyKey: input.idempotencyKey,
            periodDate,
            timeZone: input.timeZone,
            sourceCutoffAt,
            missionSetHash,
            createdByUserId: principal.userId,
            missionFacts: {
              create: missions.map((mission) => ({
                organizationId: principal.organizationId,
                missionId: mission.id,
                clientId: mission.clientId,
                contractId: mission.contractId,
                routeId: mission.routeId,
                warehouseId: mission.warehouseId,
                carrierId: mission.carrierId,
                driverId: mission.driverId,
                missionState: this.missionState(mission),
                exceptionFacts: mission.exceptions.map((exception) => ({
                  id: exception.id,
                  ruleCode: exception.ruleCode,
                  stopId: exception.stopId,
                  severity: exception.severity,
                  statusAtCutoff:
                    exception.resolvedAt && exception.resolvedAt <= sourceCutoffAt
                      ? 'RESOLVED'
                      : 'OPEN',
                  openedAt: exception.openedAt.toISOString(),
                  resolvedAt:
                    exception.resolvedAt && exception.resolvedAt <= sourceCutoffAt
                      ? exception.resolvedAt.toISOString()
                      : null,
                  delayMinutes: exception.delayMinutes,
                  actualQuantity: exception.actualQuantity?.toString() ?? null,
                  toleranceQuantity: exception.toleranceQuantity?.toString() ?? null,
                })),
                externalDataAvailability: {
                  temperature: { available: false, source: null },
                  accident: { available: false, source: null },
                  traffic: { available: false, source: null },
                  weather: { available: false, source: null },
                },
                capturedAt: sourceCutoffAt,
              })),
            },
          },
          include: { missionFacts: { orderBy: { missionId: 'asc' } } },
        });
        await tx.auditLog.create({
          data: {
            organizationId: principal.organizationId,
            actorUserId: principal.userId,
            entityType: 'KpiFactSnapshot',
            entityId: snapshot.id,
            action: 'kpi_fact_snapshot.created',
            newValues: {
              configurationId: configuration.id,
              periodDate: input.periodDate,
              timeZone: input.timeZone,
              sourceCutoffAt: sourceCutoffAt.toISOString(),
              missionIds,
              missionSetHash,
              scoreCalculated: false,
            },
          },
        });
        return snapshot;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private matchesScope(
    scopeType: RuleScopeType,
    scopeId: string,
    mission: {
      organizationId: string;
      clientId: string;
      contractId: string | null;
      warehouseId: string;
      carrierId: string | null;
      driverId: string | null;
      routeId: string | null;
    },
  ) {
    const values: Record<RuleScopeType, string | null> = {
      ORGANIZATION: mission.organizationId,
      CLIENT: mission.clientId,
      WAREHOUSE: mission.warehouseId,
      CARRIER: mission.carrierId,
      CONTRACT: mission.contractId,
      ROUTE: mission.routeId,
      DRIVER: mission.driverId,
    };
    return values[scopeType] === scopeId;
  }

  private missionState(mission: {
    missionNo: string;
    status: string;
    scheduledLoadingAt: Date | null;
    actualLoadingAt: Date | null;
    scheduledDepartureAt: Date | null;
    actualDepartureAt: Date | null;
    stops: Array<{
      id: string;
      status: string;
      expectedArrival: Date | null;
      actualArrival: Date | null;
    }>;
    documents: Array<{ type: string; verificationStatus: string; stopId: string | null }>;
    events: Array<{ eventType: string; occurredAt: Date }>;
    contract: { temperatureMonitoringRequired: boolean } | null;
  }): Prisma.InputJsonValue {
    return {
      missionNo: mission.missionNo,
      status: mission.status,
      scheduledLoadingAt: mission.scheduledLoadingAt?.toISOString() ?? null,
      actualLoadingAt: mission.actualLoadingAt?.toISOString() ?? null,
      scheduledDepartureAt: mission.scheduledDepartureAt?.toISOString() ?? null,
      actualDepartureAt: mission.actualDepartureAt?.toISOString() ?? null,
      stops: mission.stops.map((stop) => ({
        id: stop.id,
        status: stop.status,
        expectedArrival: stop.expectedArrival?.toISOString() ?? null,
        actualArrival: stop.actualArrival?.toISOString() ?? null,
      })),
      documents: mission.documents,
      events: mission.events.map((event) => ({
        eventType: event.eventType,
        occurredAt: event.occurredAt.toISOString(),
      })),
      temperatureMonitoringRequired: mission.contract?.temperatureMonitoringRequired ?? false,
    };
  }

  private validateTimeZone(timeZone: string) {
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
    } catch {
      throw new ConflictException('timeZone must be a valid IANA time-zone identifier');
    }
  }
}
