import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { MISSION_EVENT_TYPES } from '../missions/mission.constants';
import type { RecoverRouteDeviationDto } from './dto/recover-route-deviation.dto';
import type { StartRouteDeviationDto } from './dto/start-route-deviation.dto';
import { RULE_CODES } from './rule-codes';

@Injectable()
export class RouteDeviationsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(principal: AuthenticatedPrincipal, missionId: string, input: StartRouteDeviationDto) {
    const occurredAt = new Date(input.occurredAt);
    return this.prisma.$transaction(async (tx) => {
      const lockKey = this.lockKey(principal.organizationId, missionId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const mission = await tx.mission.findFirst({
        where: {
          id: missionId,
          organizationId: principal.organizationId,
          routeId: { not: null },
          status: { notIn: ['OPERATIONALLY_CLOSED', 'ACCOUNTING_READY', 'CLOSED', 'CANCELLED'] },
        },
        select: {
          id: true,
          organizationId: true,
          clientId: true,
          routeId: true,
          warehouseId: true,
          carrierId: true,
          vehicleId: true,
          driverId: true,
        },
      });
      if (!mission) throw new NotFoundException('Mission with an assigned route not found');

      const activeKey = this.activeKey(principal.organizationId, missionId);
      const existing = await tx.operationalException.findUnique({
        where: { activeKey },
        include: { alerts: true },
      });
      if (existing) return existing;

      const incident = await tx.operationalException.create({
        data: {
          organizationId: mission.organizationId,
          missionId: mission.id,
          ruleCode: RULE_CODES.routeDeviation,
          activeKey,
          occurrenceKey: `${activeKey}:${occurredAt.toISOString()}`,
          clientId: mission.clientId,
          routeId: mission.routeId,
          warehouseId: mission.warehouseId,
          carrierId: mission.carrierId,
          vehicleId: mission.vehicleId,
          driverId: mission.driverId,
          actualAt: occurredAt,
          openedAt: occurredAt,
          lastDetectedAt: occurredAt,
          context: { deviationStartedAt: occurredAt.toISOString() },
          alerts: {
            create: {
              organizationId: mission.organizationId,
              channel: 'EMAIL',
              escalationDueAt: new Date(occurredAt.getTime() + 14 * 60_000),
            },
          },
        },
        include: { alerts: true },
      });
      await tx.missionEvent.create({
        data: {
          organizationId: mission.organizationId,
          missionId,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.routeDeviationDetected,
          occurredAt,
          payload: { incidentId: incident.id, routeId: mission.routeId },
        },
      });
      await this.audit(tx, principal, 'OperationalException', incident.id, 'exception.opened', {
        ruleCode: RULE_CODES.routeDeviation,
        missionId,
        routeId: mission.routeId,
        deviationStartedAt: occurredAt.toISOString(),
      });
      await this.audit(tx, principal, 'Alert', incident.alerts[0].id, 'alert.created', {
        exceptionId: incident.id,
        ruleCode: RULE_CODES.routeDeviation,
      });
      await this.audit(
        tx,
        principal,
        'OperationalException',
        incident.id,
        'route_deviation.detected',
        {
          missionId,
          routeId: mission.routeId,
          deviationStartedAt: occurredAt.toISOString(),
        },
      );
      return incident;
    });
  }

  async recover(
    principal: AuthenticatedPrincipal,
    missionId: string,
    incidentId: string,
    input: RecoverRouteDeviationDto,
  ) {
    const returnedAt = new Date(input.returnedAt);
    return this.prisma.$transaction(async (tx) => {
      const lockKey = this.lockKey(principal.organizationId, missionId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const incident = await tx.operationalException.findFirst({
        where: {
          id: incidentId,
          organizationId: principal.organizationId,
          missionId,
          ruleCode: RULE_CODES.routeDeviation,
        },
        include: { alerts: true },
      });
      if (!incident) throw new NotFoundException('Route-deviation incident not found');
      if (incident.status === 'RESOLVED') return incident;
      if (returnedAt < incident.openedAt) {
        throw new BadRequestException('Route return timestamp cannot precede deviation start');
      }

      const durationMinutes = Math.floor(
        (returnedAt.getTime() - incident.openedAt.getTime()) / 60_000,
      );
      const transition = await tx.operationalException.updateMany({
        where: { id: incident.id, status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          activeKey: null,
          actualAt: returnedAt,
          lastDetectedAt: returnedAt,
          resolvedAt: returnedAt,
          resolutionNotes: 'Driver returned to expected route',
          delayMinutes: durationMinutes,
          context: {
            deviationStartedAt: incident.openedAt.toISOString(),
            returnedToRouteAt: returnedAt.toISOString(),
            durationMinutes,
          },
        },
      });
      const updated = await tx.operationalException.findUniqueOrThrow({
        where: { id: incident.id },
        include: { alerts: true },
      });
      if (transition.count === 0) return updated;

      await tx.missionEvent.create({
        data: {
          organizationId: principal.organizationId,
          missionId,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.routeDeviationRecovered,
          occurredAt: returnedAt,
          payload: {
            incidentId: incident.id,
            routeId: incident.routeId,
            deviationStartedAt: incident.openedAt.toISOString(),
            returnedToRouteAt: returnedAt.toISOString(),
            durationMinutes,
          },
        },
      });
      await this.audit(tx, principal, 'OperationalException', incident.id, 'exception.resolved', {
        ruleCode: RULE_CODES.routeDeviation,
        returnedToRouteAt: returnedAt.toISOString(),
        durationMinutes,
      });
      await this.audit(
        tx,
        principal,
        'OperationalException',
        incident.id,
        'route_deviation.recovered',
        {
          missionId,
          routeId: incident.routeId,
          deviationStartedAt: incident.openedAt.toISOString(),
          returnedToRouteAt: returnedAt.toISOString(),
          durationMinutes,
        },
      );
      return updated;
    });
  }

  private lockKey(organizationId: string, missionId: string) {
    return `MISSION_OPERATIONAL:${organizationId}:${missionId}`;
  }

  private activeKey(organizationId: string, missionId: string) {
    return `${organizationId}:${missionId}:MISSION:${RULE_CODES.routeDeviation}`;
  }

  private audit(
    tx: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    entityType: string,
    entityId: string,
    action: string,
    newValues: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        entityType,
        entityId,
        action,
        newValues,
      },
    });
  }
}
