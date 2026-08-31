import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type {
  Mission,
  MissionStop,
  RuleConfiguration,
  RuleDefinition,
} from '../../generated/prisma/client';
import { RULE_CODES, type RuleCode } from './rule-codes';
import { CONTINUOUS_WORKING_CALENDAR } from './working-calendar';

type MissionContext = Pick<
  Mission,
  | 'id'
  | 'organizationId'
  | 'clientId'
  | 'contractId'
  | 'routeId'
  | 'warehouseId'
  | 'carrierId'
  | 'vehicleId'
  | 'driverId'
>;

interface EvaluationContext {
  mission: MissionContext;
  stop?: Pick<MissionStop, 'id'>;
  eventId: string;
  occurrenceId?: string;
  actorUserId?: string;
  occurredAt: Date;
  affectedStopIds: string[];
}

interface EffectiveRule {
  definition: RuleDefinition;
  configuration?: RuleConfiguration;
  enabled: boolean;
  thresholdMinutes?: number;
  quantityTolerance?: Prisma.Decimal;
}

@Injectable()
export class RuleEvaluatorService {
  async describeRule(
    tx: Prisma.TransactionClient,
    ruleCode: RuleCode,
    mission: MissionContext,
    at: Date,
  ) {
    const rule = await this.resolveRule(tx, ruleCode, mission, at);
    if (!rule) return { available: false as const, ruleCode, evaluationAt: at };
    return {
      available: true as const,
      ruleCode,
      evaluationAt: at,
      enabled: rule.enabled,
      thresholdMinutes: rule.thresholdMinutes ?? null,
      source: rule.configuration ? ('CONFIGURATION' as const) : ('DEFINITION_DEFAULT' as const),
      configuration: rule.configuration
        ? {
            id: rule.configuration.id,
            version: rule.configuration.version,
            scopeType: rule.configuration.scopeType,
            scopeId: rule.configuration.scopeId,
            effectiveFrom: rule.configuration.effectiveFrom,
            effectiveTo: rule.configuration.effectiveTo,
            timeZone: rule.configuration.timeZone,
            workingCalendar: rule.configuration.workingCalendar,
          }
        : null,
    };
  }

  async evaluateTimeRule(
    tx: Prisma.TransactionClient,
    input: EvaluationContext & {
      ruleCode: Extract<RuleCode, 'LOADING_DELAY' | 'DEPARTURE_DELAY' | 'STOP_ARRIVAL_DELAY'>;
      scheduledAt: Date | null;
      actualAt: Date | null;
    },
  ) {
    const rule = await this.resolveRule(tx, input.ruleCode, input.mission, input.occurredAt);
    if (!rule?.enabled) return;
    if (!input.scheduledAt || !input.actualAt) {
      await this.recordMissingData(tx, {
        ...input,
        missingFields: [
          ...(!input.scheduledAt ? ['scheduledAt'] : []),
          ...(!input.actualAt ? ['actualAt'] : []),
        ],
        sourceRuleCode: input.ruleCode,
      });
      return;
    }
    if (rule.thresholdMinutes === undefined) return;
    const delayMinutes = Math.max(
      0,
      Math.floor((input.actualAt.getTime() - input.scheduledAt.getTime()) / 60_000),
    );
    if (delayMinutes <= rule.thresholdMinutes) return;
    await this.upsertException(tx, input, rule, {
      scheduledAt: input.scheduledAt,
      actualAt: input.actualAt,
      delayMinutes,
      context: {
        thresholdMinutes: rule.thresholdMinutes,
        timeZone: rule.configuration?.timeZone ?? null,
        workingCalendar: rule.configuration?.workingCalendar ?? CONTINUOUS_WORKING_CALENDAR,
      },
    });
  }

  async evaluateQuantityRule(
    tx: Prisma.TransactionClient,
    input: EvaluationContext & {
      ruleCode: Extract<RuleCode, 'SHORTAGE' | 'REJECTION'>;
      quantity: Prisma.Decimal | null;
    },
  ) {
    const rule = await this.resolveRule(tx, input.ruleCode, input.mission, input.occurredAt);
    if (!rule?.enabled || !input.quantity) return;
    const tolerance = rule.quantityTolerance ?? new Prisma.Decimal(0);
    if (input.quantity.lte(tolerance)) return;
    await this.upsertException(tx, input, rule, {
      actualQuantity: input.quantity,
      toleranceQuantity: tolerance,
      context: { quantityRule: input.ruleCode },
    });
  }

  private async recordMissingData(
    tx: Prisma.TransactionClient,
    input: EvaluationContext & { missingFields: string[]; sourceRuleCode: RuleCode },
  ) {
    const rule = await this.resolveRule(
      tx,
      RULE_CODES.missingOperationalData,
      input.mission,
      input.occurredAt,
    );
    if (!rule?.enabled) return;
    await this.upsertException(
      tx,
      { ...input, ruleCode: RULE_CODES.missingOperationalData },
      rule,
      {
        context: { sourceRuleCode: input.sourceRuleCode, missingFields: input.missingFields },
      },
    );
  }

  private async resolveRule(
    tx: Prisma.TransactionClient,
    ruleCode: RuleCode,
    mission: MissionContext,
    at: Date,
  ): Promise<EffectiveRule | undefined> {
    const definition = await tx.ruleDefinition.findUnique({ where: { code: ruleCode } });
    if (!definition) return;
    const scopes = [
      { scopeType: 'ORGANIZATION' as const, scopeId: mission.organizationId },
      { scopeType: 'CLIENT' as const, scopeId: mission.clientId },
      { scopeType: 'WAREHOUSE' as const, scopeId: mission.warehouseId },
      ...(mission.contractId
        ? [{ scopeType: 'CONTRACT' as const, scopeId: mission.contractId }]
        : []),
      ...(mission.carrierId ? [{ scopeType: 'CARRIER' as const, scopeId: mission.carrierId }] : []),
    ];
    const configurations = await tx.ruleConfiguration.findMany({
      where: {
        organizationId: mission.organizationId,
        ruleCode,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        AND: [{ OR: scopes }],
      },
      orderBy: [{ priority: 'desc' }, { version: 'desc' }],
    });
    const specificity = {
      ORGANIZATION: 0,
      CLIENT: 1,
      CARRIER: 2,
      WAREHOUSE: 3,
      CONTRACT: 4,
    } as const;
    const configuration = configurations.sort(
      (left, right) =>
        right.priority - left.priority ||
        specificity[right.scopeType as keyof typeof specificity] -
          specificity[left.scopeType as keyof typeof specificity],
    )[0];
    return {
      definition,
      configuration,
      enabled: configuration?.isEnabled ?? definition.enabledByDefault,
      thresholdMinutes:
        configuration?.thresholdMinutes ?? definition.defaultThresholdMinutes ?? undefined,
      quantityTolerance:
        configuration?.quantityTolerance ?? definition.defaultQuantityTolerance ?? undefined,
    };
  }

  private async upsertException(
    tx: Prisma.TransactionClient,
    input: EvaluationContext & { ruleCode: RuleCode },
    rule: EffectiveRule,
    facts: {
      scheduledAt?: Date;
      actualAt?: Date;
      delayMinutes?: number;
      actualQuantity?: Prisma.Decimal;
      toleranceQuantity?: Prisma.Decimal;
      context: Prisma.InputJsonValue;
    },
  ) {
    const target = input.stop?.id ?? 'MISSION';
    const activeKey = `${input.mission.organizationId}:${input.mission.id}:${target}:${input.ruleCode}`;
    const occurrenceKey = `${activeKey}:${input.occurrenceId ?? input.eventId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${activeKey}, 0))`;
    const existing = await tx.operationalException.findUnique({ where: { activeKey } });
    if (existing) {
      const updated = await tx.operationalException.update({
        where: { id: existing.id },
        data: { ...facts, lastDetectedAt: input.occurredAt, context: facts.context },
      });
      await this.audit(tx, input, updated.id, 'exception.updated', {
        ruleCode: input.ruleCode,
        delayMinutes: facts.delayMinutes ?? null,
        actualQuantity: facts.actualQuantity?.toString() ?? null,
      });
      return updated;
    }
    if (
      await tx.operationalException.findFirst({
        where: { organizationId: input.mission.organizationId, occurrenceKey, status: 'RESOLVED' },
        select: { id: true },
      })
    ) {
      return;
    }
    const priorResolved = await tx.operationalException.findFirst({
      where: {
        organizationId: input.mission.organizationId,
        missionId: input.mission.id,
        stopId: input.stop?.id ?? null,
        ruleCode: input.ruleCode,
        status: 'RESOLVED',
      },
      select: { id: true },
    });
    const created = await tx.operationalException.create({
      data: {
        organizationId: input.mission.organizationId,
        missionId: input.mission.id,
        stopId: input.stop?.id,
        ruleCode: input.ruleCode,
        ruleConfigurationId: rule.configuration?.id,
        activeKey,
        occurrenceKey,
        severity: rule.configuration?.severity,
        isBlocking: rule.configuration?.isBlocking ?? false,
        ownerUserId: rule.configuration?.ownerUserId,
        ownerScopeType: rule.configuration?.ownerScopeType,
        ownerScopeId: rule.configuration?.ownerScopeId,
        clientId: input.mission.clientId,
        routeId: input.mission.routeId,
        warehouseId: input.mission.warehouseId,
        carrierId: input.mission.carrierId,
        vehicleId: input.mission.vehicleId,
        driverId: input.mission.driverId,
        ...facts,
        openedAt: input.occurredAt,
        lastDetectedAt: input.occurredAt,
        affectedStops: {
          create: input.affectedStopIds.map((stopId) => ({ stopId })),
        },
        alerts: {
          create: {
            organizationId: input.mission.organizationId,
            userId: rule.configuration?.ownerUserId,
            channel: 'EMAIL',
            escalationDueAt: new Date(input.occurredAt.getTime() + 14 * 60_000),
          },
        },
      },
      include: { alerts: true },
    });
    await this.audit(
      tx,
      input,
      created.id,
      priorResolved ? 'exception.reopened' : 'exception.opened',
      {
        ruleCode: input.ruleCode,
        severity: created.severity,
        isBlocking: created.isBlocking,
        ruleConfigurationId: created.ruleConfigurationId,
      },
    );
    await tx.auditLog.create({
      data: {
        organizationId: input.mission.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'Alert',
        entityId: created.alerts[0].id,
        action: 'alert.created',
        newValues: {
          exceptionId: created.id,
          ruleCode: input.ruleCode,
          channel: created.alerts[0].channel,
          escalationDueAt: created.alerts[0].escalationDueAt.toISOString(),
        },
      },
    });
    return created;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    input: EvaluationContext,
    entityId: string,
    action: string,
    newValues: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: input.mission.organizationId,
        actorUserId: input.actorUserId,
        entityType: 'OperationalException',
        entityId,
        action,
        newValues,
      },
    });
  }
}
