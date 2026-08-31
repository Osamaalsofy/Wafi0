import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Operational intelligence authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let otherOrganizationId: string;
  let clientId: string;
  let otherClientId: string;
  let warehouseId: string;
  let otherWarehouseId: string;
  let branchId: string;
  let secondBranchId: string;
  let otherBranchId: string;
  let missionId: string;
  let otherMissionId: string;
  let exceptionId: string;
  let otherExceptionId: string;
  let alertId: string;
  let contractId: string;
  let routeId: string;
  let routeMissionId: string;
  let driverId: string;
  let clientKpiConfigurationId: string;
  let administratorId: string;
  let administratorToken: string;
  let viewerToken: string;
  const password = 'Operational-intelligence-123';

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error('E2E tests require DATABASE_URL to reference a database ending in _test');
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = randomUUID().slice(0, 8);
    const organization = await prisma.organization.create({
      data: { code: `oi-e2e-${suffix}`, name: 'OI E2E Organization' },
    });
    const otherOrganization = await prisma.organization.create({
      data: { code: `oi-e2e-other-${suffix}`, name: 'Other OI E2E Organization' },
    });
    organizationId = organization.id;
    otherOrganizationId = otherOrganization.id;
    await prisma.rootCauseCategory.create({
      data: {
        organizationId,
        code: 'E2E_CAUSE',
        nameEn: 'E2E cause',
        nameAr: 'سبب اختبار E2E',
      },
    });
    const client = await prisma.client.create({
      data: { organizationId, code: 'OI-E2E', name: 'OI E2E Client' },
    });
    const otherClient = await prisma.client.create({
      data: { organizationId: otherOrganizationId, code: 'OI-OTHER', name: 'Other OI Client' },
    });
    clientId = client.id;
    otherClientId = otherClient.id;
    const carrier = await prisma.carrier.create({
      data: { organizationId, code: `OI-CARRIER-${suffix}`, name: 'OI Carrier' },
    });
    const driver = await prisma.driver.create({
      data: { organizationId, carrierId: carrier.id, name: 'OI Driver' },
    });
    driverId = driver.id;
    const warehouse = await prisma.warehouse.create({
      data: { organizationId, clientId, code: 'OI-E2E-WH', name: 'OI E2E Warehouse' },
    });
    warehouseId = warehouse.id;
    const otherWarehouse = await prisma.warehouse.create({
      data: {
        organizationId: otherOrganizationId,
        clientId: otherClientId,
        code: 'OI-OTHER-WH',
        name: 'Other OI Warehouse',
      },
    });
    otherWarehouseId = otherWarehouse.id;
    const branch = await prisma.branch.create({
      data: { organizationId, clientId, code: 'OI-STOP-1', name: 'Riyadh Stop 1' },
    });
    const secondBranch = await prisma.branch.create({
      data: { organizationId, clientId, code: 'OI-STOP-2', name: 'Riyadh Stop 2' },
    });
    const otherBranch = await prisma.branch.create({
      data: {
        organizationId: otherOrganizationId,
        clientId: otherClientId,
        code: 'OI-OTHER-STOP',
        name: 'Other Stop',
      },
    });
    branchId = branch.id;
    secondBranchId = secondBranch.id;
    otherBranchId = otherBranch.id;
    const mission = await prisma.mission.create({
      data: {
        organizationId,
        missionNo: `OI-E2E-M-${suffix}`,
        clientId,
        warehouseId: warehouse.id,
      },
    });
    const otherMission = await prisma.mission.create({
      data: {
        organizationId: otherOrganizationId,
        missionNo: `OI-OTHER-M-${suffix}`,
        clientId: otherClientId,
        warehouseId: otherWarehouse.id,
      },
    });
    missionId = mission.id;
    otherMissionId = otherMission.id;

    const permissionCodes = [
      'rule.read',
      'rule.manage',
      'rule.evaluate',
      'exception.read',
      'exception.manage',
      'root_cause.create',
      'decision.create',
      'action.create',
      'action.update',
      'alert.read',
      'alert.update',
      'alert.deliver',
      'alert.escalate',
      'kpi.read',
      'kpi.manage',
      'kpi.snapshot',
      'contract.read',
      'contract.manage',
      'mission.read',
      'mission.create',
      'route.read',
      'route.manage',
      'audit.read',
    ];
    const permissions = await Promise.all(
      permissionCodes.map((code) =>
        prisma.permission.upsert({ where: { code }, create: { code }, update: {} }),
      ),
    );
    const readCodes = new Set([
      'rule.read',
      'exception.read',
      'alert.read',
      'kpi.read',
      'contract.read',
      'route.read',
    ]);
    const adminRole = await prisma.role.create({
      data: {
        organizationId,
        code: 'OI_ADMIN',
        name: 'OI Administrator',
        permissions: { create: permissions.map(({ id }) => ({ permissionId: id })) },
      },
    });
    const viewerRole = await prisma.role.create({
      data: {
        organizationId,
        code: 'OI_VIEWER',
        name: 'OI Viewer',
        permissions: {
          create: permissions
            .filter(({ code }) => readCodes.has(code))
            .map(({ id }) => ({ permissionId: id })),
        },
      },
    });
    const fleetManagerRole = await prisma.role.create({
      data: { organizationId, code: 'FLEET_MANAGER', name: 'Fleet Manager' },
    });
    const passwordHash = await hash(password, 4);
    const administrator = await prisma.user.create({
      data: {
        organizationId,
        email: `oi-admin-${suffix}@example.com`,
        name: 'OI Admin',
        passwordHash,
        roleAssignments: {
          create: [
            { roleId: adminRole.id, scopeType: 'ORGANIZATION', scopeId: organizationId },
            {
              roleId: fleetManagerRole.id,
              scopeType: 'ORGANIZATION',
              scopeId: organizationId,
            },
          ],
        },
      },
    });
    administratorId = administrator.id;
    const viewer = await prisma.user.create({
      data: {
        organizationId,
        email: `oi-viewer-${suffix}@example.com`,
        name: 'OI Viewer',
        passwordHash,
        roleAssignments: {
          create: { roleId: viewerRole.id, scopeType: 'ORGANIZATION', scopeId: organizationId },
        },
      },
    });
    administratorToken = await login(organization.code, administrator.email);
    viewerToken = await login(organization.code, viewer.email);

    const exception = await prisma.operationalException.create({
      data: {
        organizationId,
        missionId,
        ruleCode: 'LOADING_DELAY',
        activeKey: `${organizationId}:${missionId}:MISSION:LOADING_DELAY`,
        occurrenceKey: `${organizationId}:${missionId}:MISSION:LOADING_DELAY:e2e`,
        clientId,
        warehouseId: warehouse.id,
        scheduledAt: new Date('2026-08-10T08:00:00Z'),
        actualAt: new Date('2026-08-10T08:31:00Z'),
        delayMinutes: 31,
        context: { thresholdMinutes: 30 },
        alerts: {
          create: {
            organizationId,
            channel: 'EMAIL',
            escalationDueAt: new Date('2026-08-01T00:14:00Z'),
            createdAt: new Date('2026-08-10T09:59:00Z'),
          },
        },
      },
    });
    exceptionId = exception.id;
    alertId = (await prisma.alert.findFirstOrThrow({ where: { exceptionId } })).id;
    const otherException = await prisma.operationalException.create({
      data: {
        organizationId: otherOrganizationId,
        missionId: otherMissionId,
        ruleCode: 'LOADING_DELAY',
        activeKey: `${otherOrganizationId}:${otherMissionId}:MISSION:LOADING_DELAY`,
        occurrenceKey: `${otherOrganizationId}:${otherMissionId}:MISSION:LOADING_DELAY:e2e`,
        clientId: otherClientId,
        warehouseId: otherWarehouse.id,
        context: {},
      },
    });
    otherExceptionId = otherException.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    const organizations = [organizationId, otherOrganizationId];
    await prisma.refreshSession.deleteMany({
      where: { user: { organizationId: { in: organizations } } },
    });
    await prisma.alertDeliveryAttempt.deleteMany({
      where: { organizationId: { in: organizations } },
    });
    await prisma.alertEscalation.deleteMany({
      where: { organizationId: { in: organizations } },
    });
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
    await prisma.rootCauseCategory.deleteMany({
      where: { organizationId: { in: organizations } },
    });
    await prisma.kpiMissionFact.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.kpiFactSnapshot.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.kpiConfiguration.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.ruleConfiguration.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.missionEvent.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.mission.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.routeStop.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.operationalRoute.deleteMany({
      where: { organizationId: { in: organizations } },
    });
    await prisma.contractParty.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.operationalContract.deleteMany({
      where: { organizationId: { in: organizations } },
    });
    await prisma.warehouse.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.branch.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.driver.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.carrier.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.userRole.deleteMany({
      where: { user: { organizationId: { in: organizations } } },
    });
    await prisma.user.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: organizations } } },
    });
    await prisma.role.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: organizations } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizations } } });
    await app.close();
  });

  function server() {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }
  async function login(organizationCode: string, email: string) {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .send({ organizationCode, email, password })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }
  const authorized = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('rejects unauthenticated access to every Phase 5 read surface', async () => {
    await request(server()).get('/api/v1/rule-configurations').expect(401);
    await request(server()).get('/api/v1/exceptions').expect(401);
    await request(server()).get('/api/v1/alerts').expect(401);
    await request(server()).get('/api/v1/kpi-configurations').expect(401);
    await request(server()).get('/api/v1/contracts').expect(401);
    await request(server()).get('/api/v1/routes').expect(401);
    await request(server())
      .get(`/api/v1/audit-logs/context?contextType=EXCEPTION&contextId=${exceptionId}`)
      .expect(401);
  });

  it('allows read-only access but rejects every management operation', async () => {
    await request(server())
      .get('/api/v1/rule-configurations/options')
      .set(authorized(viewerToken))
      .expect(200);
    await request(server()).get('/api/v1/exceptions').set(authorized(viewerToken)).expect(200);
    await request(server()).get('/api/v1/alerts').set(authorized(viewerToken)).expect(200);
    await request(server())
      .get('/api/v1/kpi-configurations/options')
      .set(authorized(viewerToken))
      .expect(200);
    await request(server()).get('/api/v1/contracts').set(authorized(viewerToken)).expect(200);
    await request(server()).get('/api/v1/routes').set(authorized(viewerToken)).expect(200);
    await request(server())
      .post('/api/v1/rule-configurations')
      .set(authorized(viewerToken))
      .send({})
      .expect(403);
    await request(server())
      .post('/api/v1/routes')
      .set(authorized(viewerToken))
      .send({})
      .expect(403);
    await request(server())
      .post('/api/v1/contracts')
      .set(authorized(viewerToken))
      .send({})
      .expect(403);
    await request(server())
      .post('/api/v1/contracts/expire-due')
      .set(authorized(viewerToken))
      .send({ evaluationAt: '2026-10-01T00:00:00Z' })
      .expect(403);
    await request(server())
      .post('/api/v1/rule-evaluations/reevaluate')
      .set(authorized(viewerToken))
      .send({ evaluationAt: '2026-08-11T10:00:00Z', missionId })
      .expect(403);
    await request(server())
      .post(`/api/v1/exceptions/${exceptionId}/severity`)
      .set(authorized(viewerToken))
      .send({ severity: 'HIGH' })
      .expect(403);
    await request(server())
      .post(`/api/v1/exceptions/${exceptionId}/root-causes`)
      .set(authorized(viewerToken))
      .send({ category: 'Unapproved', description: 'Must not be accepted' })
      .expect(403);
    await request(server())
      .post(`/api/v1/alerts/${alertId}/read`)
      .set(authorized(viewerToken))
      .expect(403);
    await request(server())
      .post('/api/v1/kpi-configurations')
      .set(authorized(viewerToken))
      .send({})
      .expect(403);
    await request(server())
      .get(`/api/v1/audit-logs/context?contextType=EXCEPTION&contextId=${exceptionId}`)
      .set(authorized(viewerToken))
      .expect(403);
  });

  it('creates and reads only tenant-valid operational contracts', async () => {
    const created = await request(server())
      .post('/api/v1/contracts')
      .set(authorized(administratorToken))
      .send({
        code: 'DAILY-CLIENT',
        name: 'Daily client operations',
        cadence: 'DAILY',
        effectiveFrom: '2026-08-12T00:00:00Z',
        effectiveTo: '2026-09-12T00:00:00Z',
        parties: [{ partyType: 'CLIENT', partyId: clientId }],
      })
      .expect(201);
    contractId = (created.body as { id: string }).id;

    await request(server())
      .post(`/api/v1/contracts/${contractId}/transition`)
      .set(authorized(administratorToken))
      .send({ status: 'ACTIVE' })
      .expect(201);

    await request(server())
      .get(`/api/v1/contracts/${contractId}`)
      .set(authorized(administratorToken))
      .expect(200);
    await request(server())
      .post('/api/v1/contracts')
      .set(authorized(administratorToken))
      .send({
        code: 'CROSS-TENANT',
        name: 'Cross tenant contract',
        cadence: 'MONTHLY',
        effectiveFrom: '2026-08-12T00:00:00Z',
        effectiveTo: '2026-09-12T00:00:00Z',
        parties: [{ partyType: 'CLIENT', partyId: otherClientId }],
      })
      .expect(404);
  });

  it('associates a new mission with its active client contract', async () => {
    const response = await request(server())
      .post('/api/v1/missions')
      .set(authorized(administratorToken))
      .send({
        missionNo: `CONTRACT-MISSION-${randomUUID().slice(0, 8)}`,
        clientId,
        contractId,
        warehouseId,
        scheduledLoadingAt: '2026-08-20T08:00:00Z',
      })
      .expect(201);

    expect(response.body).toMatchObject({ clientId, contractId, warehouseId });
  });

  it('creates an explicitly zoned route with deterministic tenant stops', async () => {
    await request(server())
      .post('/api/v1/routes')
      .set(authorized(administratorToken))
      .send({
        clientId,
        code: `INVALID_TZ_${randomUUID().slice(0, 8).toUpperCase()}`,
        name: 'Invalid Saudi route timezone',
        cityRegion: 'Riyadh',
        timeZone: 'UTC',
        stops: [{ branchId, sequence: 1 }],
      })
      .expect(409);
    const created = await request(server())
      .post('/api/v1/routes')
      .set(authorized(administratorToken))
      .send({
        clientId,
        code: 'RIYADH-DAILY',
        name: 'Riyadh daily route',
        cityRegion: 'Riyadh',
        timeZone: 'Asia/Riyadh',
        stops: [
          { branchId: secondBranchId, sequence: 2 },
          { branchId, sequence: 1 },
        ],
      })
      .expect(201);
    routeId = (created.body as { id: string }).id;
    const route = await request(server())
      .get(`/api/v1/routes/${routeId}`)
      .set(authorized(administratorToken))
      .expect(200);
    expect(route.body).toMatchObject({ clientId, cityRegion: 'Riyadh', timeZone: 'Asia/Riyadh' });
    expect(
      (route.body as { stops: Array<{ sequence: number }> }).stops.map(({ sequence }) => sequence),
    ).toEqual([1, 2]);

    await request(server())
      .post('/api/v1/routes')
      .set(authorized(administratorToken))
      .send({
        clientId,
        code: 'CROSS-TENANT-ROUTE',
        name: 'Cross tenant route',
        cityRegion: 'Riyadh',
        timeZone: 'Asia/Riyadh',
        stops: [{ branchId: otherBranchId, sequence: 1 }],
      })
      .expect(404);
  });

  it('associates a mission only with an active route for its tenant and client', async () => {
    const created = await request(server())
      .post('/api/v1/missions')
      .set(authorized(administratorToken))
      .send({
        missionNo: `OI-ROUTE-${randomUUID().slice(0, 8)}`,
        clientId,
        contractId,
        routeId,
        warehouseId,
        scheduledLoadingAt: '2026-08-21T08:00:00Z',
      })
      .expect(201);

    expect(created.body).toMatchObject({ clientId, contractId, routeId, warehouseId });
    routeMissionId = (created.body as { id: string }).id;
    const mission = await request(server())
      .get(`/api/v1/missions/${routeMissionId}`)
      .set(authorized(administratorToken))
      .expect(200);
    expect(mission.body).toMatchObject({
      routeId,
      route: { id: routeId, cityRegion: 'Riyadh', timeZone: 'Asia/Riyadh' },
    });

    await request(server())
      .post('/api/v1/missions')
      .set(authorized(administratorToken))
      .send({
        missionNo: `OI-CROSS-ROUTE-${randomUUID().slice(0, 8)}`,
        clientId: otherClientId,
        routeId,
        warehouseId: otherWarehouseId,
      })
      .expect(404);
  });

  it('records each recovered route deviation as a distinct idempotent incident', async () => {
    const first = await request(server())
      .post(`/api/v1/missions/${routeMissionId}/route-deviations`)
      .set(authorized(administratorToken))
      .send({ occurredAt: '2026-08-21T10:00:00Z' })
      .expect(201);
    const duplicate = await request(server())
      .post(`/api/v1/missions/${routeMissionId}/route-deviations`)
      .set(authorized(administratorToken))
      .send({ occurredAt: '2026-08-21T10:01:00Z' })
      .expect(201);
    const firstBody = first.body as { id: string; alerts: unknown[] };
    const duplicateBody = duplicate.body as { id: string };
    expect(duplicateBody.id).toBe(firstBody.id);
    expect(firstBody.alerts).toHaveLength(1);

    const recovered = await request(server())
      .post(`/api/v1/missions/${routeMissionId}/route-deviations/${firstBody.id}/recover`)
      .set(authorized(administratorToken))
      .send({ returnedAt: '2026-08-21T10:08:00Z' })
      .expect(201);
    expect(recovered.body).toMatchObject({ status: 'RESOLVED', delayMinutes: 8 });

    const second = await request(server())
      .post(`/api/v1/missions/${routeMissionId}/route-deviations`)
      .set(authorized(administratorToken))
      .send({ occurredAt: '2026-08-21T11:20:00Z' })
      .expect(201);
    const secondBody = second.body as { id: string; alerts: unknown[] };
    expect(secondBody.id).not.toBe(firstBody.id);
    expect(secondBody.alerts).toHaveLength(1);
    expect(
      await prisma.operationalException.count({
        where: { missionId: routeMissionId, ruleCode: 'ROUTE_DEVIATION' },
      }),
    ).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId,
          entityId: firstBody.id,
          action: { in: ['route_deviation.detected', 'route_deviation.recovered'] },
        },
      }),
    ).toBe(2);

    await request(server())
      .post(`/api/v1/missions/${routeMissionId}/route-deviations/${secondBody.id}/recover`)
      .set(authorized(viewerToken))
      .send({ returnedAt: '2026-08-21T11:27:00Z' })
      .expect(403);
    await request(server())
      .post(`/api/v1/missions/${otherMissionId}/route-deviations`)
      .set(authorized(administratorToken))
      .send({ occurredAt: '2026-08-21T12:00:00Z' })
      .expect(404);
  });

  it('creates validated rule and KPI contract versions for the authenticated tenant', async () => {
    const clientRule = await request(server())
      .post('/api/v1/rule-configurations')
      .set(authorized(administratorToken))
      .send({
        ruleCode: 'LOADING_DELAY',
        scopeType: 'CLIENT',
        scopeId: clientId,
        thresholdMinutes: 30,
        severity: 'WARNING',
        isBlocking: false,
        timeZone: 'Asia/Muscat',
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(201);
    expect(clientRule.body).toMatchObject({
      workingCalendar: {
        mode: 'CONTINUOUS_24_7',
        pauseSlaOnWeekends: false,
        pauseSlaOnOfficialHolidays: false,
        holidayWorkClassification: 'OVERTIME',
      },
    });
    await request(server())
      .post('/api/v1/rule-configurations')
      .set(authorized(administratorToken))
      .send({
        ruleCode: 'STOP_ARRIVAL_DELAY',
        scopeType: 'CLIENT',
        scopeId: clientId,
        workingCalendar: { pauseSlaOnOfficialHolidays: true },
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(409);
    const clientKpi = await request(server())
      .post('/api/v1/kpi-configurations')
      .set(authorized(administratorToken))
      .send({
        kpiCode: 'ON_TIME_LOADING',
        scopeType: 'CLIENT',
        scopeId: clientId,
        isEnabled: false,
        formula: { status: 'pending_approval' },
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(201);
    clientKpiConfigurationId = (clientKpi.body as { id: string }).id;
    const driverKpi = await request(server())
      .post('/api/v1/kpi-configurations')
      .set(authorized(administratorToken))
      .send({
        kpiCode: 'ON_TIME_LOADING',
        scopeType: 'DRIVER',
        scopeId: driverId,
        isEnabled: false,
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(201);
    expect(driverKpi.body).toMatchObject({
      scopeType: 'DRIVER',
      scopeId: driverId,
      targetPercent: '90',
      calculationFrequency: 'DAILY',
    });
    await request(server())
      .post('/api/v1/rule-configurations')
      .set(authorized(administratorToken))
      .send({
        ruleCode: 'LOADING_DELAY',
        scopeType: 'DRIVER',
        scopeId: driverId,
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(409);
    await request(server())
      .post('/api/v1/rule-configurations')
      .set(authorized(administratorToken))
      .send({
        ruleCode: 'DEPARTURE_DELAY',
        scopeType: 'CONTRACT',
        scopeId: contractId,
        thresholdMinutes: 30,
        isBlocking: false,
        effectiveFrom: '2026-08-12T00:00:00Z',
      })
      .expect(201);
    await request(server())
      .post('/api/v1/kpi-configurations')
      .set(authorized(administratorToken))
      .send({
        kpiCode: 'ON_TIME_DEPARTURE',
        scopeType: 'CONTRACT',
        scopeId: contractId,
        isEnabled: false,
        calculationFrequency: 'DAILY',
        targets: { percentage: 90 },
        effectiveFrom: '2026-08-12T00:00:00Z',
      })
      .expect(201);
    const rules = await request(server())
      .get('/api/v1/rule-configurations')
      .set(authorized(administratorToken))
      .expect(200);
    const kpis = await request(server())
      .get('/api/v1/kpi-configurations')
      .set(authorized(administratorToken))
      .expect(200);
    expect((rules.body as Array<{ scopeId: string }>).map(({ scopeId }) => scopeId)).toEqual(
      expect.arrayContaining([clientId, contractId]),
    );
    expect((kpis.body as Array<{ scopeId: string }>).map(({ scopeId }) => scopeId)).toEqual(
      expect.arrayContaining([clientId, contractId]),
    );
  });

  it('freezes immutable tenant-scoped mission facts without calculating a KPI score', async () => {
    const idempotencyKey = randomUUID();
    const payload = {
      configurationId: clientKpiConfigurationId,
      idempotencyKey,
      periodDate: '2026-08-21',
      timeZone: 'Asia/Riyadh',
      sourceCutoffAt: '2026-08-21T12:30:00Z',
      missionIds: [routeMissionId],
    };
    const created = await request(server())
      .post('/api/v1/kpi-fact-snapshots')
      .set(authorized(administratorToken))
      .send(payload)
      .expect(201);
    const createdBody = created.body as {
      id: string;
      missionFacts: Array<{
        missionId: string;
        exceptionFacts: Array<{ ruleCode: string }>;
        externalDataAvailability: { temperature: { available: boolean } };
      }>;
    };
    expect(createdBody.missionFacts).toHaveLength(1);
    expect(createdBody.missionFacts[0]).toMatchObject({
      missionId: routeMissionId,
      externalDataAvailability: { temperature: { available: false } },
    });
    expect(createdBody.missionFacts[0]?.exceptionFacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleCode: 'ROUTE_DEVIATION' })]),
    );

    const repeated = await request(server())
      .post('/api/v1/kpi-fact-snapshots')
      .set(authorized(administratorToken))
      .send(payload)
      .expect(201);
    expect((repeated.body as { id: string }).id).toBe(createdBody.id);
    await request(server())
      .post('/api/v1/kpi-fact-snapshots')
      .set(authorized(administratorToken))
      .send({ ...payload, missionIds: [missionId] })
      .expect(409);
    await request(server())
      .post('/api/v1/kpi-fact-snapshots')
      .set(authorized(administratorToken))
      .send({ ...payload, idempotencyKey: randomUUID(), missionIds: [otherMissionId] })
      .expect(404);
    await request(server())
      .post('/api/v1/kpi-fact-snapshots')
      .set(authorized(administratorToken))
      .send({ ...payload, idempotencyKey: randomUUID(), timeZone: 'UTC' })
      .expect(409);
    await request(server())
      .post('/api/v1/kpi-fact-snapshots')
      .set(authorized(viewerToken))
      .send({ ...payload, idempotencyKey: randomUUID() })
      .expect(403);
    await request(server())
      .get(`/api/v1/kpi-fact-snapshots/${createdBody.id}`)
      .set(authorized(viewerToken))
      .expect(200);
  });

  it('expires due contracts idempotently and blocks them from new operational use', async () => {
    const first = await request(server())
      .post('/api/v1/contracts/expire-due')
      .set(authorized(administratorToken))
      .send({ evaluationAt: '2026-10-01T00:00:00Z', limit: 100 })
      .expect(201);
    expect(first.body).toMatchObject({ expiredIds: [contractId], remainingMayExist: false });

    const repeated = await request(server())
      .post('/api/v1/contracts/expire-due')
      .set(authorized(administratorToken))
      .send({ evaluationAt: '2026-10-01T00:00:00Z', limit: 100 })
      .expect(201);
    expect(repeated.body).toMatchObject({ expiredIds: [], remainingMayExist: false });

    await request(server())
      .post('/api/v1/missions')
      .set(authorized(administratorToken))
      .send({
        missionNo: `EXPIRED-CONTRACT-${randomUUID().slice(0, 8)}`,
        clientId,
        contractId,
        warehouseId,
      })
      .expect(404);
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: 'OperationalContract',
          entityId: contractId,
          action: 'contract.expired',
        },
      }),
    ).toBe(1);
  });

  it('rejects invalid input and cross-tenant configuration scopes', async () => {
    await request(server())
      .post('/api/v1/rule-configurations')
      .set(authorized(administratorToken))
      .send({
        ruleCode: 'DEPARTURE_DELAY',
        scopeType: 'INVALID',
        scopeId: clientId,
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(400);
    await request(server())
      .post('/api/v1/rule-configurations')
      .set(authorized(administratorToken))
      .send({
        ruleCode: 'DEPARTURE_DELAY',
        scopeType: 'CLIENT',
        scopeId: otherClientId,
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(404);
    await request(server())
      .post('/api/v1/kpi-configurations')
      .set(authorized(administratorToken))
      .send({
        kpiCode: 'EXCEPTION_RATE',
        scopeType: 'CLIENT',
        scopeId: otherClientId,
        effectiveFrom: '2026-08-01T00:00:00Z',
      })
      .expect(404);
  });

  it('requires bounded manual reevaluation and accepts an authorized mission scope', async () => {
    await request(server())
      .post('/api/v1/rule-evaluations/reevaluate')
      .set(authorized(administratorToken))
      .send({ evaluationAt: '2026-08-11T10:00:00Z' })
      .expect(409);
    const response = await request(server())
      .post('/api/v1/rule-evaluations/reevaluate')
      .set(authorized(administratorToken))
      .send({ evaluationAt: '2026-08-11T10:00:00Z', missionId })
      .expect(201);
    expect(response.body).toMatchObject({ missions: 1, timeRulesEvaluated: 0 });
  });

  it('isolates exception details, applies authorized workflow changes, and exposes their audit context', async () => {
    const listed = await request(server())
      .get('/api/v1/exceptions')
      .set(authorized(administratorToken))
      .expect(200);
    expect((listed.body as { data: Array<{ id: string }> }).data.map(({ id }) => id)).toContain(
      exceptionId,
    );
    await request(server())
      .get(`/api/v1/exceptions/${exceptionId}`)
      .set(authorized(administratorToken))
      .expect(200);
    await request(server())
      .get(`/api/v1/exceptions/${randomUUID()}`)
      .set(authorized(administratorToken))
      .expect(404);
    await request(server())
      .post(`/api/v1/exceptions/${exceptionId}/severity`)
      .set(authorized(administratorToken))
      .send({ severity: 'HIGH' })
      .expect(201);
    await request(server())
      .post(`/api/v1/exceptions/${exceptionId}/root-causes`)
      .set(authorized(administratorToken))
      .send({ category: 'E2E_CAUSE', description: 'Traceable acceptance cause', confirmed: true })
      .expect(201);
    const decision = await request(server())
      .post(`/api/v1/exceptions/${exceptionId}/decisions`)
      .set(authorized(administratorToken))
      .send({ decisionText: 'Traceable acceptance decision' })
      .expect(201);
    const decisionId = (decision.body as { id: string }).id;
    const action = await request(server())
      .post(`/api/v1/decisions/${decisionId}/actions`)
      .set(authorized(administratorToken))
      .send({ ownerUserId: administratorId, actionText: 'Traceable corrective action' })
      .expect(201);
    await request(server())
      .post(`/api/v1/actions/${(action.body as { id: string }).id}/complete`)
      .set(authorized(administratorToken))
      .send({ notes: 'Acceptance action completed' })
      .expect(201);
    const timeline = await request(server())
      .get(`/api/v1/audit-logs/context?contextType=EXCEPTION&contextId=${exceptionId}`)
      .set(authorized(administratorToken))
      .expect(200);
    expect((timeline.body as Array<{ action: string }>).map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'exception.severity_changed',
        'root_cause.created',
        'decision.created',
        'action.created',
        'action.completed',
      ]),
    );
  });

  it('enforces email retry timing and idempotent Fleet Manager escalation', async () => {
    await request(server())
      .post(`/api/v1/alerts/${alertId}/delivery-attempts/1`)
      .set(authorized(administratorToken))
      .send({ outcome: 'SENT', attemptedAt: '2026-08-10T09:58:59Z' })
      .expect(400);
    const firstAttempt = await request(server())
      .post(`/api/v1/alerts/${alertId}/delivery-attempts/1`)
      .set(authorized(administratorToken))
      .send({
        outcome: 'FAILED',
        attemptedAt: '2026-08-10T10:00:00Z',
        error: 'Test delivery failure',
      })
      .expect(201);
    expect(firstAttempt.body).toMatchObject({
      attemptNo: 1,
      outcome: 'FAILED',
      nextAttemptAt: '2026-08-10T10:05:00.000Z',
    });
    const duplicate = await request(server())
      .post(`/api/v1/alerts/${alertId}/delivery-attempts/1`)
      .set(authorized(administratorToken))
      .send({ outcome: 'FAILED', attemptedAt: '2026-08-10T10:01:00Z' })
      .expect(201);
    const firstAttemptBody = firstAttempt.body as { id: string };
    const duplicateBody = duplicate.body as { id: string };
    expect(duplicateBody.id).toBe(firstAttemptBody.id);
    await request(server())
      .post(`/api/v1/alerts/${alertId}/delivery-attempts/2`)
      .set(authorized(administratorToken))
      .send({ outcome: 'SENT', attemptedAt: '2026-08-10T10:04:59Z' })
      .expect(400);
    await request(server())
      .post(`/api/v1/alerts/${alertId}/delivery-attempts/2`)
      .set(authorized(administratorToken))
      .send({ outcome: 'SENT', attemptedAt: '2026-08-10T10:05:00Z' })
      .expect(201);
    expect(await prisma.alertDeliveryAttempt.count({ where: { alertId } })).toBe(2);

    const escalated = await request(server())
      .post('/api/v1/alerts/escalate-due')
      .set(authorized(administratorToken))
      .send({ evaluatedAt: '2026-08-10T10:14:00Z', limit: 25 })
      .expect(201);
    expect(escalated.body).toMatchObject({ escalated: 1, skippedNoFleetManager: 0 });
    expect(
      await prisma.alertEscalation.count({
        where: { alertId, recipientUserId: administratorId },
      }),
    ).toBe(1);
    const repeated = await request(server())
      .post('/api/v1/alerts/escalate-due')
      .set(authorized(administratorToken))
      .send({ evaluatedAt: '2026-08-10T10:15:00Z', limit: 25 })
      .expect(201);
    expect((repeated.body as { escalated: number }).escalated).toBe(0);
    await request(server())
      .post('/api/v1/alerts/escalate-due')
      .set(authorized(viewerToken))
      .send({ evaluatedAt: '2026-08-10T10:15:00Z', limit: 25 })
      .expect(403);
  });

  it('marks a tenant alert read and does not expose another tenant exception', async () => {
    const readAlert = await request(server())
      .post(`/api/v1/alerts/${alertId}/read`)
      .set(authorized(administratorToken))
      .expect(201);
    const readAlertBody = readAlert.body as { status: string; readAt: string | null };
    expect(readAlertBody).toMatchObject({ status: 'SENT' });
    expect(readAlertBody.readAt).not.toBeNull();
    const alerts = await request(server())
      .get('/api/v1/alerts?unreadOnly=true')
      .set(authorized(administratorToken))
      .expect(200);
    expect((alerts.body as { data: Array<{ id: string }> }).data.map(({ id }) => id)).not.toContain(
      alertId,
    );
    await request(server())
      .get(`/api/v1/exceptions/${otherExceptionId}`)
      .set(authorized(administratorToken))
      .expect(404);
  });
});
