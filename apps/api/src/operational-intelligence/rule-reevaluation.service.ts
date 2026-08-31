import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { ReevaluateRulesDto } from './dto/reevaluate-rules.dto';
import { RULE_CODES } from './rule-codes';
import { RuleEvaluatorService } from './rule-evaluator.service';

@Injectable()
export class RuleReevaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: RuleEvaluatorService,
  ) {}

  async reevaluate(principal: AuthenticatedPrincipal, input: ReevaluateRulesDto) {
    const evaluationAt = new Date(input.evaluationAt);
    const scheduledFrom = input.scheduledFrom ? new Date(input.scheduledFrom) : undefined;
    const scheduledTo = input.scheduledTo ? new Date(input.scheduledTo) : undefined;
    if (!input.missionId && (!scheduledFrom || !scheduledTo)) {
      throw new ConflictException(
        'missionId or a complete scheduledFrom/scheduledTo window is required',
      );
    }
    if (scheduledFrom && scheduledTo && scheduledTo <= scheduledFrom) {
      throw new ConflictException('scheduledTo must be later than scheduledFrom');
    }
    if (
      (input.afterUpdatedAt && !input.afterMissionId) ||
      (!input.afterUpdatedAt && input.afterMissionId)
    ) {
      throw new ConflictException('afterUpdatedAt and afterMissionId must be provided together');
    }

    const scheduleWindow =
      scheduledFrom && scheduledTo ? { gte: scheduledFrom, lt: scheduledTo } : undefined;
    const afterUpdatedAt = input.afterUpdatedAt ? new Date(input.afterUpdatedAt) : undefined;
    const where: Prisma.MissionWhereInput = {
      organizationId: principal.organizationId,
      id: input.missionId,
      clientId: input.clientId,
      warehouseId: input.warehouseId,
      ...(scheduleWindow
        ? {
            OR: [
              { scheduledLoadingAt: scheduleWindow },
              { scheduledDepartureAt: scheduleWindow },
              { stops: { some: { expectedArrival: scheduleWindow } } },
            ],
          }
        : {}),
      ...(afterUpdatedAt && input.afterMissionId
        ? {
            AND: [
              {
                OR: [
                  { updatedAt: { gt: afterUpdatedAt } },
                  { updatedAt: afterUpdatedAt, id: { gt: input.afterMissionId } },
                ],
              },
            ],
          }
        : {}),
    };
    const candidates = await this.prisma.mission.findMany({
      where,
      include: { stops: { orderBy: { sequence: 'asc' } } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: input.maxMissions + 1,
    });
    const hasMore = candidates.length > input.maxMissions;
    const missions = candidates.slice(0, input.maxMissions);

    const totals = { missions: missions.length, timeRulesEvaluated: 0, futureOperationsSkipped: 0 };
    for (const mission of missions) {
      await this.prisma.$transaction(async (tx) => {
        const candidates = [
          {
            ruleCode: RULE_CODES.loadingDelay,
            scheduledAt: mission.scheduledLoadingAt,
            actualAt: mission.actualLoadingAt,
            stop: undefined,
            affectedStopIds: mission.stops.map(({ id }) => id),
          },
          {
            ruleCode: RULE_CODES.departureDelay,
            scheduledAt: mission.scheduledDepartureAt,
            actualAt: mission.actualDepartureAt,
            stop: undefined,
            affectedStopIds: mission.stops.map(({ id }) => id),
          },
          ...mission.stops.map((stop) => ({
            ruleCode: RULE_CODES.stopArrivalDelay,
            scheduledAt: stop.expectedArrival,
            actualAt: stop.actualArrival,
            stop,
            affectedStopIds: [stop.id],
          })),
        ] as const;
        const due = candidates.filter((candidate) => {
          if (candidate.actualAt) {
            if (candidate.actualAt <= evaluationAt) return true;
            totals.futureOperationsSkipped += 1;
            return false;
          }
          if (!candidate.scheduledAt) return false;
          if (candidate.scheduledAt <= evaluationAt) return true;
          totals.futureOperationsSkipped += 1;
          return false;
        });
        if (!due.length) return;
        const event = await tx.missionEvent.create({
          data: {
            organizationId: principal.organizationId,
            missionId: mission.id,
            actorUserId: principal.userId,
            eventType: 'MANUAL_RULE_REEVALUATION_REQUESTED',
            occurredAt: evaluationAt,
            source: 'MANUAL_REEVALUATION',
            payload: { evaluationAt: evaluationAt.toISOString(), candidateCount: due.length },
          },
        });
        for (const candidate of due) {
          const sourceTimestamp = candidate.actualAt ?? candidate.scheduledAt;
          await this.evaluator.evaluateTimeRule(tx, {
            mission,
            stop: candidate.stop,
            eventId: event.id,
            occurrenceId: `${candidate.ruleCode}:${candidate.stop?.id ?? 'MISSION'}:${sourceTimestamp?.toISOString() ?? 'MISSING'}`,
            actorUserId: principal.userId,
            occurredAt: evaluationAt,
            affectedStopIds: candidate.affectedStopIds,
            ruleCode: candidate.ruleCode,
            scheduledAt: candidate.scheduledAt,
            actualAt: candidate.actualAt,
          });
          totals.timeRulesEvaluated += 1;
        }
        await tx.auditLog.create({
          data: {
            organizationId: principal.organizationId,
            actorUserId: principal.userId,
            entityType: 'Mission',
            entityId: mission.id,
            action: 'rule_evaluation.manual_requested',
            newValues: {
              evaluationAt: evaluationAt.toISOString(),
              evaluatedRuleCount: due.length,
              missionEventId: event.id,
            },
          },
        });
      });
    }
    const last = missions.at(-1);
    return {
      evaluationAt: evaluationAt.toISOString(),
      ...totals,
      nextCursor:
        hasMore && last
          ? { afterUpdatedAt: last.updatedAt.toISOString(), afterMissionId: last.id }
          : null,
    };
  }
}
