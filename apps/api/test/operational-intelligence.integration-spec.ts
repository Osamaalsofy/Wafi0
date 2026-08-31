import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Environment } from '../src/environment';
import type { AuthenticatedPrincipal } from '../src/auth/auth.types';
import { PrismaService } from '../src/database/prisma.service';
import { ExceptionsService } from '../src/operational-intelligence/exceptions.service';
import { KpiConfigurationsService } from '../src/operational-intelligence/kpi-configurations.service';
import { RuleConfigurationsService } from '../src/operational-intelligence/rule-configurations.service';
import { RuleEvaluatorService } from '../src/operational-intelligence/rule-evaluator.service';

describe('Phase 5 operational-intelligence acceptance', () => {
  const databaseUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let rules: RuleConfigurationsService;
  let kpis: KpiConfigurationsService;
  let exceptions: ExceptionsService;
  let evaluator: RuleEvaluatorService;
  let organizationAId: string;
  let organizationBId: string;
  let userAId: string;
  let userBId: string;
  let clientAId: string;
  let clientBId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let missionAId: string;
  let missionBId: string;

  it('stores the approved configurable SLA defaults', async () => {
    const definitions = await prisma.ruleDefinition.findMany({
      where: { code: { in: ['LOADING_DELAY', 'DEPARTURE_DELAY', 'STOP_ARRIVAL_DELAY'] } },
      select: { code: true, defaultThresholdMinutes: true, enabledByDefault: true },
      orderBy: { code: 'asc' },
    });

    expect(definitions).toEqual([
      { code: 'DEPARTURE_DELAY', defaultThresholdMinutes: 30, enabledByDefault: true },
      { code: 'LOADING_DELAY', defaultThresholdMinutes: 15, enabledByDefault: true },
      { code: 'STOP_ARRIVAL_DELAY', defaultThresholdMinutes: 15, enabledByDefault: true },
    ]);
  });

  beforeAll(async () => {
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error(
        'Integration tests require DATABASE_URL to reference a database ending in _test',
      );
    }
    prisma = new PrismaService(new ConfigService<Environment, true>({ DATABASE_URL: databaseUrl }));
    rules = new RuleConfigurationsService(prisma);
    kpis = new KpiConfigurationsService(prisma);
    exceptions = new ExceptionsService(prisma);
    evaluator = new RuleEvaluatorService();

    const suffix = randomUUID().slice(0, 8);
    const organizationA = await prisma.organization.create({
      data: { code: `OI-A-${suffix}`, name: 'OI Organization A' },
    });
    const organizationB = await prisma.organization.create({
      data: { code: `OI-B-${suffix}`, name: 'OI Organization B' },
    });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;
    const userA = await prisma.user.create({
      data: {
        organizationId: organizationAId,
        email: `oi-a-${suffix}@example.com`,
        name: 'OI User A',
        passwordHash: 'integration-only',
      },
    });
    const userB = await prisma.user.create({
      data: {
        organizationId: organizationBId,
        email: `oi-b-${suffix}@example.com`,
        name: 'OI User B',
        passwordHash: 'integration-only',
      },
    });
    userAId = userA.id;
    userBId = userB.id;
    const clientA = await prisma.client.create({
      data: { organizationId: organizationAId, code: 'OI-A', name: 'OI Client A' },
    });
    const clientB = await prisma.client.create({
      data: { organizationId: organizationBId, code: 'OI-B', name: 'OI Client B' },
    });
    clientAId = clientA.id;
    clientBId = clientB.id;
    const warehouseA = await prisma.warehouse.create({
      data: {
        organizationId: organizationAId,
        clientId: clientAId,
        code: 'OI-WH-A',
        name: 'OI Warehouse A',
      },
    });
    const warehouseB = await prisma.warehouse.create({
      data: {
        organizationId: organizationBId,
        clientId: clientBId,
        code: 'OI-WH-B',
        name: 'OI Warehouse B',
      },
    });
    warehouseAId = warehouseA.id;
    warehouseBId = warehouseB.id;
    const missionA = await prisma.mission.create({
      data: {
        organizationId: organizationAId,
        missionNo: `OI-M-A-${suffix}`,
        clientId: clientAId,
        warehouseId: warehouseAId,
        scheduledLoadingAt: new Date('2026-08-10T08:00:00Z'),
      },
    });
    const missionB = await prisma.mission.create({
      data: {
        organizationId: organizationBId,
        missionNo: `OI-M-B-${suffix}`,
        clientId: clientBId,
        warehouseId: warehouseBId,
        scheduledLoadingAt: new Date('2026-08-10T08:00:00Z'),
      },
    });
    missionAId = missionA.id;
    missionBId = missionB.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    const organizations = [organizationAId, organizationBId];
    await prisma.alert.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.correctiveAction.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.decision.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.rootCause.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.exceptionEvidence.deleteMany({
      where: { exception: { organizationId: { in: organizations } } },
    });
    await prisma.exceptionStop.deleteMany({
      where: { exception: { organizationId: { in: organizations } } },
    });
    await prisma.operationalException.deleteMany({
      where: { organizationId: { in: organizations } },
    });
    await prisma.kpiConfiguration.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.ruleConfiguration.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.missionEvent.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.mission.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.warehouse.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizations } } });
    await prisma.$disconnect();
  });

  const principal = (organizationId: string, userId: string): AuthenticatedPrincipal => ({
    userId,
    organizationId,
    email: 'oi@example.com',
    grants: [],
  });

  it('selects the effective client rule version and deduplicates an active exception', async () => {
    await rules.create(principal(organizationAId, userAId), {
      ruleCode: 'LOADING_DELAY',
      scopeType: 'CLIENT',
      scopeId: clientAId,
      priority: 0,
      isEnabled: true,
      thresholdMinutes: 10,
      isBlocking: false,
      effectiveFrom: '2026-08-01T00:00:00Z',
      effectiveTo: '2026-09-01T00:00:00Z',
    });
    const mission = await prisma.mission.findUniqueOrThrow({ where: { id: missionAId } });
    const firstEvent = await prisma.missionEvent.create({
      data: {
        organizationId: organizationAId,
        missionId: missionAId,
        actorUserId: userAId,
        eventType: 'LOADING_DELAY_EVALUATED',
        occurredAt: new Date('2026-08-10T08:15:00Z'),
      },
    });
    await prisma.$transaction((tx) =>
      evaluator.evaluateTimeRule(tx, {
        mission,
        eventId: firstEvent.id,
        actorUserId: userAId,
        occurredAt: firstEvent.occurredAt,
        affectedStopIds: [],
        ruleCode: 'LOADING_DELAY',
        scheduledAt: mission.scheduledLoadingAt,
        actualAt: firstEvent.occurredAt,
      }),
    );
    const secondEvent = await prisma.missionEvent.create({
      data: {
        organizationId: organizationAId,
        missionId: missionAId,
        actorUserId: userAId,
        eventType: 'LOADING_DELAY_REEVALUATED',
        occurredAt: new Date('2026-08-10T08:20:00Z'),
      },
    });
    await prisma.$transaction((tx) =>
      evaluator.evaluateTimeRule(tx, {
        mission,
        eventId: secondEvent.id,
        actorUserId: userAId,
        occurredAt: secondEvent.occurredAt,
        affectedStopIds: [],
        ruleCode: 'LOADING_DELAY',
        scheduledAt: mission.scheduledLoadingAt,
        actualAt: secondEvent.occurredAt,
      }),
    );

    const active = await prisma.operationalException.findMany({
      where: { missionId: missionAId, ruleCode: 'LOADING_DELAY', status: 'OPEN' },
    });
    expect(active).toHaveLength(1);
    expect(active[0]?.delayMinutes).toBe(20);
    expect(active[0]?.ruleConfigurationId).not.toBeNull();
  });

  it('serializes concurrent creation of the same active exception', async () => {
    const suffix = randomUUID().slice(0, 8);
    const mission = await prisma.mission.create({
      data: {
        organizationId: organizationAId,
        missionNo: `OI-CONCURRENT-${suffix}`,
        clientId: clientAId,
        warehouseId: warehouseAId,
        scheduledLoadingAt: new Date('2026-08-10T08:00:00Z'),
      },
    });
    const events = await Promise.all(
      ['2026-08-10T08:15:00Z', '2026-08-10T08:20:00Z'].map((occurredAt, index) =>
        prisma.missionEvent.create({
          data: {
            organizationId: organizationAId,
            missionId: mission.id,
            actorUserId: userAId,
            eventType: `CONCURRENT_LOADING_DELAY_${index + 1}`,
            occurredAt: new Date(occurredAt),
          },
        }),
      ),
    );

    await Promise.all(
      events.map((event) =>
        prisma.$transaction((tx) =>
          evaluator.evaluateTimeRule(tx, {
            mission,
            eventId: event.id,
            actorUserId: userAId,
            occurredAt: event.occurredAt,
            affectedStopIds: [],
            ruleCode: 'LOADING_DELAY',
            scheduledAt: mission.scheduledLoadingAt,
            actualAt: event.occurredAt,
          }),
        ),
      ),
    );

    const active = await prisma.operationalException.findMany({
      where: { missionId: mission.id, ruleCode: 'LOADING_DELAY', status: 'OPEN' },
      include: { alerts: true },
    });
    expect(active).toHaveLength(1);
    expect(active[0]?.alerts).toHaveLength(1);
  });

  it('does not replay a resolved occurrence and reopens only for a later qualifying event', async () => {
    const current = await prisma.operationalException.findFirstOrThrow({
      where: { missionId: missionAId, status: 'OPEN' },
    });
    await Promise.all([
      exceptions.resolve(principal(organizationAId, userAId), current.id, {
        notes: 'Integration resolution A',
      }),
      exceptions.resolve(principal(organizationAId, userAId), current.id, {
        notes: 'Integration resolution B',
      }),
    ]);
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: 'OperationalException',
          entityId: current.id,
          action: 'exception.resolved',
        },
      }),
    ).toBe(1);
    const mission = await prisma.mission.findUniqueOrThrow({ where: { id: missionAId } });
    const resolvedEventId = current.occurrenceKey.split(':').at(-1)!;
    await prisma.$transaction((tx) =>
      evaluator.evaluateTimeRule(tx, {
        mission,
        eventId: resolvedEventId,
        actorUserId: userAId,
        occurredAt: current.lastDetectedAt,
        affectedStopIds: [],
        ruleCode: 'LOADING_DELAY',
        scheduledAt: mission.scheduledLoadingAt,
        actualAt: current.actualAt,
      }),
    );
    expect(await prisma.operationalException.count({ where: { missionId: missionAId } })).toBe(1);

    const newEvent = await prisma.missionEvent.create({
      data: {
        organizationId: organizationAId,
        missionId: missionAId,
        actorUserId: userAId,
        eventType: 'LOADING_DELAY_AGAIN',
        occurredAt: new Date('2026-08-10T08:25:00Z'),
      },
    });
    await prisma.$transaction((tx) =>
      evaluator.evaluateTimeRule(tx, {
        mission,
        eventId: newEvent.id,
        actorUserId: userAId,
        occurredAt: newEvent.occurredAt,
        affectedStopIds: [],
        ruleCode: 'LOADING_DELAY',
        scheduledAt: mission.scheduledLoadingAt,
        actualAt: newEvent.occurredAt,
      }),
    );
    expect(await prisma.operationalException.count({ where: { missionId: missionAId } })).toBe(2);
    expect(
      await prisma.auditLog.findFirst({
        where: { organizationId: organizationAId, action: 'exception.reopened' },
      }),
    ).not.toBeNull();
  });

  it('isolates exceptions and alerts by authenticated tenant and audits alert reads', async () => {
    const resultA = await exceptions.list(principal(organizationAId, userAId), {
      page: 1,
      limit: 25,
    });
    const resultB = await exceptions.list(principal(organizationBId, userBId), {
      page: 1,
      limit: 25,
    });
    expect(resultA.data.every(({ organizationId }) => organizationId === organizationAId)).toBe(
      true,
    );
    expect(resultB.data).toHaveLength(0);
    const alert = await prisma.alert.findFirstOrThrow({
      where: { organizationId: organizationAId, readAt: null },
    });
    const reads = await Promise.all([
      exceptions.markAlertRead(principal(organizationAId, userAId), alert.id),
      exceptions.markAlertRead(principal(organizationAId, userAId), alert.id),
    ]);
    expect(reads.every(({ status }) => status === alert.status)).toBe(true);
    expect(reads.every(({ readAt }) => readAt !== null)).toBe(true);
    expect(
      await prisma.auditLog.findFirst({
        where: { entityType: 'Alert', entityId: alert.id, action: 'alert.read' },
      }),
    ).not.toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { entityType: 'Alert', entityId: alert.id, action: 'alert.read' },
      }),
    ).toBe(1);
  });

  it('stores non-overlapping immutable rule and KPI versions and rejects overlap', async () => {
    await rules.create(principal(organizationAId, userAId), {
      ruleCode: 'DEPARTURE_DELAY',
      scopeType: 'ORGANIZATION',
      scopeId: organizationAId,
      priority: 0,
      isEnabled: false,
      isBlocking: false,
      effectiveFrom: '2026-08-01T00:00:00Z',
      effectiveTo: '2026-09-01T00:00:00Z',
    });
    await expect(
      rules.create(principal(organizationAId, userAId), {
        ruleCode: 'DEPARTURE_DELAY',
        scopeType: 'ORGANIZATION',
        scopeId: organizationAId,
        priority: 0,
        isEnabled: false,
        isBlocking: false,
        effectiveFrom: '2026-08-15T00:00:00Z',
        effectiveTo: '2026-10-01T00:00:00Z',
      }),
    ).rejects.toMatchObject({ status: 409 });

    const first = await kpis.create(principal(organizationAId, userAId), {
      kpiCode: 'ON_TIME_LOADING',
      scopeType: 'CLIENT',
      scopeId: clientAId,
      isEnabled: false,
      formula: { status: 'pending_approval' },
      effectiveFrom: '2026-08-01T00:00:00Z',
      effectiveTo: '2026-09-01T00:00:00Z',
    });
    const second = await kpis.create(principal(organizationAId, userAId), {
      kpiCode: 'ON_TIME_LOADING',
      scopeType: 'CLIENT',
      scopeId: clientAId,
      isEnabled: false,
      formula: { status: 'pending_approval_v2' },
      effectiveFrom: '2026-09-01T00:00:00Z',
    });
    expect([first.version, second.version]).toEqual([1, 2]);
    expect(first.formula).toEqual({ status: 'pending_approval' });
    expect(
      await prisma.auditLog.count({
        where: { organizationId: organizationAId, action: 'kpi_configuration.version_created' },
      }),
    ).toBe(2);
  });

  it('serializes concurrent Rule and KPI version allocation per scope', async () => {
    const ruleVersions = await Promise.all([
      rules.create(principal(organizationAId, userAId), {
        ruleCode: 'DEPARTURE_DELAY',
        scopeType: 'ORGANIZATION',
        scopeId: organizationAId,
        priority: 0,
        isEnabled: false,
        isBlocking: false,
        effectiveFrom: '2026-09-01T00:00:00Z',
        effectiveTo: '2026-10-01T00:00:00Z',
      }),
      rules.create(principal(organizationAId, userAId), {
        ruleCode: 'DEPARTURE_DELAY',
        scopeType: 'ORGANIZATION',
        scopeId: organizationAId,
        priority: 0,
        isEnabled: false,
        isBlocking: false,
        effectiveFrom: '2026-10-01T00:00:00Z',
      }),
    ]);
    expect(ruleVersions.map(({ version }) => version).sort()).toEqual([2, 3]);

    const kpiVersions = await Promise.all([
      kpis.create(principal(organizationAId, userAId), {
        kpiCode: 'EXCEPTION_RATE',
        scopeType: 'ORGANIZATION',
        scopeId: organizationAId,
        isEnabled: false,
        effectiveFrom: '2026-08-01T00:00:00Z',
        effectiveTo: '2026-09-01T00:00:00Z',
      }),
      kpis.create(principal(organizationAId, userAId), {
        kpiCode: 'EXCEPTION_RATE',
        scopeType: 'ORGANIZATION',
        scopeId: organizationAId,
        isEnabled: false,
        effectiveFrom: '2026-09-01T00:00:00Z',
      }),
    ]);
    expect(kpiVersions.map(({ version }) => version).sort()).toEqual([1, 2]);
  });

  it('cannot create a KPI scope that belongs to another tenant', async () => {
    await expect(
      kpis.create(principal(organizationAId, userAId), {
        kpiCode: 'EXCEPTION_RATE',
        scopeType: 'CLIENT',
        scopeId: clientBId,
        isEnabled: false,
        effectiveFrom: '2026-08-01T00:00:00Z',
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(missionBId).toBeDefined();
  });
});
