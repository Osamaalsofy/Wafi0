jest.mock('../../generated/prisma/client', () => ({
  Prisma: {
    Decimal: class Decimal {
      constructor(private readonly value: number) {}
      lte(other: Decimal) {
        return this.value <= other.value;
      }
      toString() {
        return String(this.value);
      }
    },
  },
}));

import type { Prisma } from '../../generated/prisma/client';
import { RuleEvaluatorService } from './rule-evaluator.service';

const mission = {
  id: 'mission-id',
  organizationId: 'organization-id',
  clientId: 'client-id',
  contractId: null,
  routeId: 'route-id',
  warehouseId: 'warehouse-id',
  carrierId: 'carrier-id',
  vehicleId: 'vehicle-id',
  driverId: 'driver-id',
};

function transaction(definition: Record<string, unknown>, configurations: unknown[] = []) {
  const findDefinition = jest.fn().mockResolvedValue(definition);
  const createException = jest
    .fn<Promise<Record<string, unknown>>, [{ data: Record<string, unknown> }]>()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'exception-id',
        ...data,
        alerts: [
          {
            id: 'alert-id',
            channel: 'EMAIL',
            escalationDueAt: new Date('2026-08-10T08:30:00Z'),
          },
        ],
      }),
    );
  const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  const findExisting = jest.fn().mockResolvedValue(null);
  const auditActions: string[] = [];
  const createAudit = jest.fn((input: { data: { action: string } }) => {
    auditActions.push(input.data.action);
    return Promise.resolve({ id: 'audit-id' });
  });
  const tx = {
    $executeRaw: queryRaw,
    ruleDefinition: { findUnique: findDefinition },
    ruleConfiguration: { findMany: jest.fn().mockResolvedValue(configurations) },
    operationalException: {
      findUnique: findExisting,
      findFirst: jest.fn().mockResolvedValue(null),
      create: createException,
      update: jest.fn(),
    },
    auditLog: { create: createAudit },
  } as unknown as Prisma.TransactionClient;
  return { tx, findDefinition, createException, auditActions, queryRaw, findExisting };
}

describe('RuleEvaluatorService', () => {
  const evaluator = new RuleEvaluatorService();

  it('uses the approved 15-minute loading-delay default without treating equality as delayed', async () => {
    const { tx, createException, auditActions } = transaction({
      code: 'LOADING_DELAY',
      enabledByDefault: true,
      defaultThresholdMinutes: 15,
      defaultQuantityTolerance: null,
    });

    await evaluator.evaluateTimeRule(tx, {
      mission,
      eventId: 'event-15',
      occurredAt: new Date('2026-08-10T08:15:00Z'),
      affectedStopIds: [],
      ruleCode: 'LOADING_DELAY',
      scheduledAt: new Date('2026-08-10T08:00:00Z'),
      actualAt: new Date('2026-08-10T08:15:00Z'),
    });
    expect(createException).not.toHaveBeenCalled();

    await evaluator.evaluateTimeRule(tx, {
      mission,
      eventId: 'event-16',
      occurredAt: new Date('2026-08-10T08:16:00Z'),
      affectedStopIds: [],
      ruleCode: 'LOADING_DELAY',
      scheduledAt: new Date('2026-08-10T08:00:00Z'),
      actualAt: new Date('2026-08-10T08:16:00Z'),
    });
    expect(createException.mock.calls[0]?.[0].data).toMatchObject({
      ruleCode: 'LOADING_DELAY',
      delayMinutes: 16,
      clientId: 'client-id',
      routeId: 'route-id',
      warehouseId: 'warehouse-id',
      carrierId: 'carrier-id',
      vehicleId: 'vehicle-id',
      driverId: 'driver-id',
      isBlocking: false,
    });
    const context = createException.mock.calls[0]?.[0].data.context as {
      workingCalendar: {
        mode: string;
        pauseSlaOnWeekends: boolean;
        pauseSlaOnOfficialHolidays: boolean;
      };
    };
    expect(context.workingCalendar).toMatchObject({
      mode: 'CONTINUOUS_24_7',
      pauseSlaOnWeekends: false,
      pauseSlaOnOfficialHolidays: false,
    });
    expect(auditActions).toContain('alert.created');
  });

  it.each([
    ['DEPARTURE_DELAY' as const, 30],
    ['STOP_ARRIVAL_DELAY' as const, 15],
  ])('applies the approved %s default of %i minutes', async (ruleCode, thresholdMinutes) => {
    const { tx, createException } = transaction({
      code: ruleCode,
      enabledByDefault: true,
      defaultThresholdMinutes: thresholdMinutes,
      defaultQuantityTolerance: null,
    });
    const scheduledAt = new Date('2026-08-10T08:00:00Z');
    const actualAt = new Date(scheduledAt.getTime() + (thresholdMinutes + 1) * 60_000);

    await evaluator.evaluateTimeRule(tx, {
      mission,
      eventId: `${ruleCode}-event`,
      occurredAt: actualAt,
      affectedStopIds: [],
      ruleCode,
      scheduledAt,
      actualAt,
    });

    expect(createException.mock.calls[0]?.[0].data).toMatchObject({
      ruleCode,
      delayMinutes: thresholdMinutes + 1,
    });
  });

  it('prefers an applicable contract configuration at equal priority', async () => {
    const at = new Date('2026-08-10T08:00:00Z');
    const { tx } = transaction(
      {
        code: 'LOADING_DELAY',
        enabledByDefault: true,
        defaultThresholdMinutes: 15,
        defaultQuantityTolerance: null,
      },
      [
        {
          id: 'client-configuration',
          scopeType: 'CLIENT',
          scopeId: mission.clientId,
          priority: 0,
          version: 1,
          isEnabled: true,
          thresholdMinutes: 10,
          effectiveFrom: at,
          effectiveTo: null,
          timeZone: null,
          workingCalendar: null,
        },
        {
          id: 'contract-configuration',
          scopeType: 'CONTRACT',
          scopeId: 'contract-id',
          priority: 0,
          version: 1,
          isEnabled: true,
          thresholdMinutes: 5,
          effectiveFrom: at,
          effectiveTo: null,
          timeZone: null,
          workingCalendar: null,
        },
      ],
    );

    const result = await evaluator.describeRule(
      tx,
      'LOADING_DELAY',
      { ...mission, contractId: 'contract-id' },
      at,
    );

    expect(result).toMatchObject({
      thresholdMinutes: 5,
      configuration: { id: 'contract-configuration', scopeType: 'CONTRACT' },
    });
  });

  it('creates a missing-operational-data condition instead of a false delay', async () => {
    const { tx, findDefinition, createException } = transaction({
      code: 'LOADING_DELAY',
      enabledByDefault: true,
      defaultThresholdMinutes: 30,
      defaultQuantityTolerance: null,
    });
    findDefinition
      .mockResolvedValueOnce({
        code: 'LOADING_DELAY',
        enabledByDefault: true,
        defaultThresholdMinutes: 30,
      })
      .mockResolvedValueOnce({
        code: 'MISSING_OPERATIONAL_DATA',
        enabledByDefault: true,
      });

    await evaluator.evaluateTimeRule(tx, {
      mission,
      eventId: 'event-missing',
      occurredAt: new Date('2026-08-10T08:31:00Z'),
      affectedStopIds: [],
      ruleCode: 'LOADING_DELAY',
      scheduledAt: new Date('2026-08-10T08:00:00Z'),
      actualAt: null,
    });

    expect(createException.mock.calls[0]?.[0].data).toMatchObject({
      ruleCode: 'MISSING_OPERATIONAL_DATA',
      context: { sourceRuleCode: 'LOADING_DELAY', missingFields: ['actualAt'] },
    });
  });

  it('serializes active-key creation before checking for an existing exception', async () => {
    const { tx, queryRaw, findExisting } = transaction({
      code: 'LOADING_DELAY',
      enabledByDefault: true,
      defaultThresholdMinutes: 30,
      defaultQuantityTolerance: null,
    });

    await evaluator.evaluateTimeRule(tx, {
      mission,
      eventId: 'concurrent-event',
      occurredAt: new Date('2026-08-10T08:31:00Z'),
      affectedStopIds: [],
      ruleCode: 'LOADING_DELAY',
      scheduledAt: new Date('2026-08-10T08:00:00Z'),
      actualAt: new Date('2026-08-10T08:31:00Z'),
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findExisting.mock.invocationCallOrder[0],
    );
  });
});
