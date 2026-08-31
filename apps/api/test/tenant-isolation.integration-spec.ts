import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { Environment } from '../src/environment';
import { PrismaService } from '../src/database/prisma.service';
import { ClientsService } from '../src/clients/clients.service';
import type { AuthenticatedPrincipal } from '../src/auth/auth.types';
import { AuthService } from '../src/auth/auth.service';
import { MissionsService } from '../src/missions/missions.service';
import { MissionStopOperationsService } from '../src/mission-stops/mission-stop-operations.service';
import { DailyLoadingService } from '../src/daily-loading/daily-loading.service';
import { DocumentsService } from '../src/documents/documents.service';
import type { DocumentStorage, StoredDocumentInput } from '../src/documents/document-storage';
import { ClosurePoliciesService } from '../src/closure-policies/closure-policies.service';
import { ControlTowerService } from '../src/control-tower/control-tower.service';
import { UsersService } from '../src/users/users.service';

class MemoryDocumentStorage implements DocumentStorage {
  readonly objects = new Map<string, Buffer>();
  put(input: StoredDocumentInput) {
    this.objects.set(input.key, input.content);
    return Promise.resolve();
  }
  get(key: string) {
    const content = this.objects.get(key);
    if (!content) return Promise.reject(new Error('Object not found'));
    return Promise.resolve(content);
  }
  delete(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }
}

describe('tenant isolation and relational integrity', () => {
  const databaseUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let clients: ClientsService;
  let auth: AuthService;
  let missions: MissionsService;
  let stopOperations: MissionStopOperationsService;
  let dailyLoading: DailyLoadingService;
  let documents: DocumentsService;
  let documentStorage: MemoryDocumentStorage;
  let closurePolicies: ClosurePoliciesService;
  let controlTower: ControlTowerService;
  let users: UsersService;
  let organizationAId: string;
  let organizationBId: string;
  let clientAId: string;
  let clientBId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let missionAId: string;
  let missionBId: string;
  let userAId: string;
  let verifierAId: string;
  let carrierAId: string;
  let vehicleAId: string;
  let driverAId: string;
  let branchAId: string;
  let stopA1Id: string;
  let stopA2Id: string;

  beforeAll(async () => {
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error(
        'Integration tests require DATABASE_URL to reference a database ending in _test',
      );
    }

    const config = new ConfigService<Environment, true>({
      DATABASE_URL: databaseUrl,
      DOCUMENT_MAX_SIZE_BYTES: 10_000_000,
      JWT_ACCESS_SECRET: 'integration-test-secret-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 30,
    });
    prisma = new PrismaService(config);
    auth = new AuthService(
      prisma,
      new JwtService({ secret: 'integration-test-secret-at-least-32-characters' }),
      config,
    );
    clients = new ClientsService(prisma);
    missions = new MissionsService(prisma);
    stopOperations = new MissionStopOperationsService(prisma);
    dailyLoading = new DailyLoadingService(prisma);
    documentStorage = new MemoryDocumentStorage();
    documents = new DocumentsService(prisma, config, documentStorage);
    closurePolicies = new ClosurePoliciesService(prisma);
    controlTower = new ControlTowerService(prisma);
    users = new UsersService(prisma);

    const suffix = randomUUID().slice(0, 8);
    const organizationA = await prisma.organization.create({
      data: { code: `TEST-A-${suffix}`, name: 'Test Organization A' },
    });
    const organizationB = await prisma.organization.create({
      data: { code: `TEST-B-${suffix}`, name: 'Test Organization B' },
    });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;
    const userA = await prisma.user.create({
      data: {
        organizationId: organizationAId,
        email: `operator-${suffix}@example.com`,
        name: 'Mission Operator',
        passwordHash: 'integration-test-only',
      },
    });
    userAId = userA.id;
    const verifierA = await prisma.user.create({
      data: {
        organizationId: organizationAId,
        email: `verifier-${suffix}@example.com`,
        name: 'Document Verifier',
        passwordHash: 'integration-test-only',
      },
    });
    verifierAId = verifierA.id;

    const clientA = await prisma.client.create({
      data: { organizationId: organizationAId, code: 'SHARED', name: 'Client A' },
    });
    const clientB = await prisma.client.create({
      data: { organizationId: organizationBId, code: 'SHARED', name: 'Client B' },
    });
    clientAId = clientA.id;
    clientBId = clientB.id;

    const warehouseA = await prisma.warehouse.create({
      data: {
        organizationId: organizationAId,
        clientId: clientAId,
        code: 'WH-A',
        name: 'Warehouse A',
      },
    });
    const warehouseB = await prisma.warehouse.create({
      data: {
        organizationId: organizationBId,
        clientId: clientBId,
        code: 'WH-B',
        name: 'Warehouse B',
      },
    });
    warehouseAId = warehouseA.id;
    warehouseBId = warehouseB.id;
    const branchA = await prisma.branch.create({
      data: {
        organizationId: organizationAId,
        clientId: clientAId,
        code: 'BR-A',
        name: 'Branch A',
      },
    });
    branchAId = branchA.id;

    const carrierA = await prisma.carrier.create({
      data: { organizationId: organizationAId, code: 'CARRIER-A', name: 'Carrier A' },
    });
    carrierAId = carrierA.id;
    const vehicleA = await prisma.vehicle.create({
      data: {
        organizationId: organizationAId,
        carrierId: carrierAId,
        plateNo: 'TEST-001',
      },
    });
    vehicleAId = vehicleA.id;
    const driverA = await prisma.driver.create({
      data: {
        organizationId: organizationAId,
        carrierId: carrierAId,
        name: 'Test Driver',
      },
    });
    driverAId = driverA.id;

    const missionA = await missions.create(principal(organizationAId, userAId), {
      missionNo: 'MISSION-A',
      clientId: clientAId,
      warehouseId: warehouseAId,
      scheduledLoadingAt: '2026-08-10T07:00:00.000Z',
    });
    const missionB = await prisma.mission.create({
      data: {
        organizationId: organizationBId,
        missionNo: 'MISSION-B',
        clientId: clientBId,
        warehouseId: warehouseBId,
        scheduledLoadingAt: '2026-08-10T07:30:00.000Z',
      },
    });
    missionAId = missionA.id;
    missionBId = missionB.id;
    const stopA1 = await missions.addStop(principal(organizationAId, userAId), missionAId, {
      branchId: branchAId,
      sequence: 1,
      expectedQty: 10,
      quantityUnit: 'UNIT',
    });
    const stopA2 = await missions.addStop(principal(organizationAId, userAId), missionAId, {
      branchId: branchAId,
      sequence: 2,
      expectedQty: 5,
      quantityUnit: 'UNIT',
    });
    stopA1Id = stopA1.id;
    stopA2Id = stopA2.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.alert.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.correctiveAction.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.decision.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.rootCause.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.exceptionEvidence.deleteMany({
      where: {
        exception: { organizationId: { in: [organizationAId, organizationBId] } },
      },
    });
    await prisma.exceptionStop.deleteMany({
      where: {
        exception: { organizationId: { in: [organizationAId, organizationBId] } },
      },
    });
    await prisma.operationalException.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.kpiConfiguration.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.ruleConfiguration.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.document.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.missionEvent.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.portalNotification.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.supportMessage.deleteMany({
      where: { ticket: { organizationId: { in: [organizationAId, organizationBId] } } },
    });
    await prisma.supportAssignment.deleteMany({
      where: { ticket: { organizationId: { in: [organizationAId, organizationBId] } } },
    });
    await prisma.supportTicket.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.missionAssignment.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.userRole.deleteMany({
      where: { user: { organizationId: { in: [organizationAId, organizationBId] } } },
    });
    await prisma.missionStop.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.mission.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.closureDocumentRequirement.deleteMany({
      where: { policy: { organizationId: { in: [organizationAId, organizationBId] } } },
    });
    await prisma.closurePolicy.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.vehicle.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.driver.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.carrier.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.warehouse.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.branch.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.client.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.user.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.role.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [organizationAId, organizationBId] } },
    });
    await prisma.$disconnect();
  });

  function principal(
    organizationId: string,
    userId: string = randomUUID(),
  ): AuthenticatedPrincipal {
    return {
      userId,
      organizationId,
      email: 'test@example.com',
      grants: [
        { permission: 'control_tower.read', scopeType: 'ORGANIZATION', scopeId: organizationId },
        { permission: 'document.read', scopeType: 'ORGANIZATION', scopeId: organizationId },
      ],
    };
  }

  it('returns only clients belonging to the authenticated organization', async () => {
    const resultA = await clients.list(principal(organizationAId), {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    const resultB = await clients.list(principal(organizationBId), {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(resultA.data.map(({ id }) => id)).toEqual([clientAId]);
    expect(resultB.data.map(({ id }) => id)).toEqual([clientBId]);
  });

  it('rotates a refresh token only once under concurrent use', async () => {
    const refreshToken = `integration-refresh-${randomUUID()}`;
    const original = await prisma.refreshSession.create({
      data: {
        userId: userAId,
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const results = await Promise.allSettled([
      auth.refresh(refreshToken),
      auth.refresh(refreshToken),
    ]);
    const storedOriginal = await prisma.refreshSession.findUniqueOrThrow({
      where: { id: original.id },
    });
    const replacementCount = await prisma.refreshSession.count({
      where: { userId: userAId, id: { not: original.id } },
    });

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(storedOriginal.revokedAt).not.toBeNull();
    expect(replacementCount).toBe(1);
  });

  it('applies a concurrent identical user-status change only once', async () => {
    const target = await prisma.user.create({
      data: {
        organizationId: organizationAId,
        email: `status-target-${randomUUID()}@example.com`,
        name: 'Status Target',
        passwordHash: 'integration-test-only',
      },
    });
    await prisma.refreshSession.create({
      data: {
        userId: target.id,
        tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const results = await Promise.all([
      users.updateStatus(principal(organizationAId, userAId), target.id, 'INACTIVE'),
      users.updateStatus(principal(organizationAId, userAId), target.id, 'INACTIVE'),
    ]);
    const auditCount = await prisma.auditLog.count({
      where: { entityId: target.id, action: 'user.status_changed' },
    });
    const activeSessionCount = await prisma.refreshSession.count({
      where: { userId: target.id, revokedAt: null },
    });

    expect(results.every(({ status }) => status === 'INACTIVE')).toBe(true);
    expect(auditCount).toBe(1);
    expect(activeSessionCount).toBe(0);
  });

  it('assigns the same organization role only once under concurrent requests', async () => {
    const suffix = randomUUID().slice(0, 8);
    const [target, role] = await Promise.all([
      prisma.user.create({
        data: {
          organizationId: organizationAId,
          email: `role-target-${suffix}@example.com`,
          name: 'Role Target',
          passwordHash: 'integration-test-only',
        },
      }),
      prisma.role.create({
        data: {
          organizationId: organizationAId,
          code: `ROLE-${suffix}`,
          name: 'Concurrent Role',
        },
      }),
    ]);

    const results = await Promise.all([
      users.assignOrganizationRole(principal(organizationAId, userAId), target.id, role.id),
      users.assignOrganizationRole(principal(organizationAId, userAId), target.id, role.id),
    ]);
    const assignmentCount = await prisma.userRole.count({
      where: {
        userId: target.id,
        roleId: role.id,
        scopeType: 'ORGANIZATION',
        scopeId: organizationAId,
      },
    });
    const auditCount = await prisma.auditLog.count({
      where: { entityId: target.id, action: 'user.role_assigned' },
    });

    expect(results[0].id).toBe(results[1].id);
    expect(assignmentCount).toBe(1);
    expect(auditCount).toBe(1);
  });

  it('does not resolve another organization client by identifier', async () => {
    await expect(clients.get(principal(organizationAId), clientBId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects a warehouse linked to a client in another organization', async () => {
    await expect(
      prisma.warehouse.create({
        data: {
          organizationId: organizationAId,
          clientId: clientBId,
          code: 'CROSS-TENANT',
          name: 'Invalid Warehouse',
        },
      }),
    ).rejects.toThrow();
  });

  it('returns only missions belonging to the authenticated organization', async () => {
    const result = await missions.list(principal(organizationAId), {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.data.map(({ id }) => id)).toEqual([missionAId]);
    await expect(missions.get(principal(organizationAId), missionBId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('persists mission creation as both an event and an audit record', async () => {
    const event = await prisma.missionEvent.findFirst({ where: { missionId: missionAId } });
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'Mission', entityId: missionAId },
    });

    expect(event?.eventType).toBe('MISSION_CREATED');
    expect(event?.actorUserId).toBe(userAId);
    expect(audit?.action).toBe('mission.created');
  });

  it('uploads, scopes, and verifies mission documents with an audit trail', async () => {
    const uploaded = await documents.upload(
      principal(organizationAId, userAId),
      { missionId: missionAId, stopId: stopA1Id, type: 'POD' },
      {
        originalname: 'proof-of-delivery.pdf',
        mimetype: 'application/pdf',
        size: 8,
        buffer: Buffer.from('%PDF-1.7'),
      },
    );

    expect(uploaded).not.toHaveProperty('storageKey');
    expect([...documentStorage.objects.values()][0]?.toString()).toBe('%PDF-1.7');
    await expect(
      documents.getContent(principal(organizationBId), uploaded.id),
    ).rejects.toMatchObject({ status: 404 });
    const content = await documents.getContent(principal(organizationAId), uploaded.id);
    expect(content.content.toString()).toBe('%PDF-1.7');
    await expect(documents.get(principal(organizationBId), uploaded.id)).rejects.toMatchObject({
      status: 404,
    });

    await documents.recordMalwareScan(principal(organizationAId, verifierAId), uploaded.id, {
      status: 'CLEAN',
    });
    const verified = await documents.verify(principal(organizationAId, verifierAId), uploaded.id, {
      status: 'VERIFIED',
      notes: 'POD is legible',
    });
    const audits = await prisma.auditLog.findMany({
      where: { entityType: 'Document', entityId: uploaded.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(verified).toMatchObject({
      verificationStatus: 'VERIFIED',
      verifiedByUserId: verifierAId,
      verificationNotes: 'POD is legible',
    });
    expect(audits.map(({ action }) => action)).toEqual([
      'document.uploaded',
      'document.malware_scan_recorded',
      'document.verification_changed',
    ]);
  });

  it('rejects a stop that does not belong to the selected mission', async () => {
    await expect(
      documents.upload(
        principal(organizationBId),
        { missionId: missionBId, stopId: stopA1Id, type: 'POD' },
        {
          originalname: 'invalid.pdf',
          mimetype: 'application/pdf',
          size: 8,
          buffer: Buffer.from('%PDF-1.7'),
        },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('assigns a coherent carrier, vehicle, and driver without changing status', async () => {
    const assigned = await missions.assign(principal(organizationAId, userAId), missionAId, {
      carrierId: carrierAId,
      vehicleId: vehicleAId,
      driverId: driverAId,
    });
    const event = await prisma.missionEvent.findFirst({
      where: { missionId: missionAId, eventType: 'MISSION_ASSIGNMENT_CHANGED' },
    });
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: missionAId, action: 'mission.assignment_changed' },
    });

    expect(assigned).toMatchObject({
      carrierId: carrierAId,
      vehicleId: vehicleAId,
      driverId: driverAId,
      status: 'DRAFT',
    });
    expect(event).not.toBeNull();
    expect(audit).not.toBeNull();

    const transitions = await Promise.all([
      missions.transition(principal(organizationAId, userAId), missionAId, {
        toStatus: 'ASSIGNED',
      }),
      missions.transition(principal(organizationAId, userAId), missionAId, {
        toStatus: 'ASSIGNED',
      }),
    ]);
    const transitionEvent = await prisma.missionEvent.findFirst({
      where: { missionId: missionAId, eventType: 'MISSION_STATUS_CHANGED' },
    });
    const transitionAudit = await prisma.auditLog.findFirst({
      where: { entityId: missionAId, action: 'mission.status_changed' },
    });
    const transitionEventCount = await prisma.missionEvent.count({
      where: { missionId: missionAId, eventType: 'MISSION_STATUS_CHANGED' },
    });
    const transitionAuditCount = await prisma.auditLog.count({
      where: { entityId: missionAId, action: 'mission.status_changed' },
    });

    expect(transitions.every(({ status }) => status === 'ASSIGNED')).toBe(true);
    expect(transitionEvent?.payload).toMatchObject({
      oldStatus: 'DRAFT',
      newStatus: 'ASSIGNED',
    });
    expect(transitionAudit).not.toBeNull();
    expect(transitionEventCount).toBe(1);
    expect(transitionAuditCount).toBe(1);
  });

  it('enforces ordered stop arrival and persists the operational timeline', async () => {
    await expect(
      stopOperations.arrive(principal(organizationAId, userAId), stopA2Id, {
        occurredAt: '2026-08-10T10:00:00.000Z',
      }),
    ).rejects.toThrow('Earlier mission stops must be completed first');

    await Promise.all([
      stopOperations.arrive(principal(organizationAId, userAId), stopA1Id, {
        occurredAt: '2026-08-10T08:00:00.000Z',
      }),
      stopOperations.arrive(principal(organizationAId, userAId), stopA1Id, {
        occurredAt: '2026-08-10T08:00:00.000Z',
      }),
    ]);
    await Promise.all([
      stopOperations.startUnloading(principal(organizationAId, userAId), stopA1Id, {
        occurredAt: '2026-08-10T08:05:00.000Z',
      }),
      stopOperations.startUnloading(principal(organizationAId, userAId), stopA1Id, {
        occurredAt: '2026-08-10T08:05:00.000Z',
      }),
    ]);
    const completions = await Promise.all([
      stopOperations.complete(principal(organizationAId, userAId), stopA1Id, {
        occurredAt: '2026-08-10T08:30:00.000Z',
        receivedQty: 9,
        shortageQty: 1,
        unit: 'UNIT',
      }),
      stopOperations.complete(principal(organizationAId, userAId), stopA1Id, {
        occurredAt: '2026-08-10T08:30:00.000Z',
        receivedQty: 9,
        shortageQty: 1,
        unit: 'UNIT',
      }),
    ]);
    const completed = completions[0];
    const second = await stopOperations.arrive(principal(organizationAId, userAId), stopA2Id, {
      occurredAt: '2026-08-10T10:00:00.000Z',
    });
    const operationEvents = await prisma.missionEvent.count({
      where: {
        missionId: missionAId,
        eventType: {
          in: ['MISSION_STOP_ARRIVED', 'MISSION_STOP_UNLOADING_STARTED', 'MISSION_STOP_COMPLETED'],
        },
      },
    });
    const operationAudits = await prisma.auditLog.count({
      where: {
        organizationId: organizationAId,
        action: {
          in: ['mission_stop.arrived', 'mission_stop.unloading_started', 'mission_stop.completed'],
        },
      },
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.receivedQty?.toString()).toBe('9');
    expect(completed.shortageQty?.toString()).toBe('1');
    expect(second.status).toBe('ARRIVED');
    expect(operationEvents).toBe(4);
    expect(operationAudits).toBe(4);
  });

  it('projects only the authenticated organization daily-loading data', async () => {
    const result = await dailyLoading.get(principal(organizationAId, userAId), {
      from: '2026-08-10T00:00:00.000Z',
      to: '2026-08-11T00:00:00.000Z',
      page: 1,
      limit: 25,
    });

    expect(result.summary.total).toBe(1);
    expect(result.summary.delayEvaluation.available).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(missionAId);
    expect(result.data[0]?.stopProgress.total).toBe(2);
  });

  it('completes the accepted mission path from draft through delivered', async () => {
    const acceptanceMission = await missions.create(principal(organizationAId, userAId), {
      missionNo: 'MISSION-ACCEPTANCE',
      clientId: clientAId,
      warehouseId: warehouseAId,
      scheduledLoadingAt: '2026-08-12T06:00:00.000Z',
    });
    const acceptanceStop = await missions.addStop(
      principal(organizationAId, userAId),
      acceptanceMission.id,
      { branchId: branchAId, sequence: 1, expectedQty: 20, quantityUnit: 'UNIT' },
    );
    await missions.assign(principal(organizationAId, userAId), acceptanceMission.id, {
      carrierId: carrierAId,
      vehicleId: vehicleAId,
      driverId: driverAId,
    });

    for (const toStatus of [
      'ASSIGNED',
      'WAITING_FOR_VEHICLE',
      'VEHICLE_ARRIVED',
      'LOADING',
      'LOADED',
      'DEPARTED',
      'IN_TRANSIT',
      'AT_STOP',
      'DELIVERING',
    ] as const) {
      await missions.transition(principal(organizationAId, userAId), acceptanceMission.id, {
        toStatus,
      });
    }

    await expect(
      missions.transition(principal(organizationAId, userAId), acceptanceMission.id, {
        toStatus: 'DELIVERED',
      }),
    ).rejects.toThrow('Every mission stop must be completed before delivery');

    await stopOperations.arrive(principal(organizationAId, userAId), acceptanceStop.id, {
      occurredAt: '2026-08-12T08:00:00.000Z',
    });
    await stopOperations.startUnloading(principal(organizationAId, userAId), acceptanceStop.id, {
      occurredAt: '2026-08-12T08:05:00.000Z',
    });
    await stopOperations.complete(principal(organizationAId, userAId), acceptanceStop.id, {
      occurredAt: '2026-08-12T08:30:00.000Z',
      receivedQty: 20,
      unit: 'UNIT',
    });
    const delivered = await missions.transition(
      principal(organizationAId, userAId),
      acceptanceMission.id,
      { toStatus: 'DELIVERED' },
    );
    await expect(
      missions.transition(principal(organizationAId, userAId), acceptanceMission.id, {
        toStatus: 'OPERATIONALLY_CLOSED',
      }),
    ).rejects.toThrow('No active OPERATIONAL_CLOSURE policy exists');

    const operationalPolicy = await closurePolicies.save(principal(organizationAId, userAId), {
      clientId: clientAId,
      stage: 'OPERATIONAL_CLOSURE',
      requirements: [{ documentType: 'POD', scope: 'EACH_STOP' }],
    });
    await closurePolicies.approve(principal(organizationAId, verifierAId), operationalPolicy.id);
    await closurePolicies.activate(principal(organizationAId, userAId), operationalPolicy.id);
    await expect(
      missions.transition(principal(organizationAId, userAId), acceptanceMission.id, {
        toStatus: 'OPERATIONALLY_CLOSED',
      }),
    ).rejects.toThrow('Missing verified POD document for EACH_STOP');
    const blockedTower = await controlTower.get(principal(organizationAId, userAId), {
      page: 1,
      limit: 25,
      search: 'MISSION-ACCEPTANCE',
    });
    expect(blockedTower.data[0]?.closureReadiness).toMatchObject({
      applicable: true,
      policyConfigured: true,
      ready: false,
      missing: [{ documentType: 'POD', scope: 'EACH_STOP', missingStopIds: [acceptanceStop.id] }],
    });
    const stopPod = await documents.upload(
      principal(organizationAId, userAId),
      { missionId: acceptanceMission.id, stopId: acceptanceStop.id, type: 'POD' },
      {
        originalname: 'stop-pod.pdf',
        mimetype: 'application/pdf',
        size: 8,
        buffer: Buffer.from('%PDF-1.7'),
      },
    );
    await documents.recordMalwareScan(principal(organizationAId, verifierAId), stopPod.id, {
      status: 'CLEAN',
    });
    await documents.verify(principal(organizationAId, verifierAId), stopPod.id, {
      status: 'VERIFIED',
    });
    const readyTower = await controlTower.get(principal(organizationAId, userAId), {
      page: 1,
      limit: 25,
      search: 'MISSION-ACCEPTANCE',
    });
    expect(readyTower.data[0]?.closureReadiness).toMatchObject({
      applicable: true,
      policyConfigured: true,
      ready: true,
      missing: [],
    });
    const closureException = await prisma.operationalException.create({
      data: {
        organizationId: organizationAId,
        missionId: acceptanceMission.id,
        ruleCode: 'LOADING_DELAY',
        activeKey: `${organizationAId}:${acceptanceMission.id}:MISSION:CLOSURE-TEST`,
        occurrenceKey: `${organizationAId}:${acceptanceMission.id}:MISSION:CLOSURE-TEST:1`,
        clientId: clientAId,
        warehouseId: warehouseAId,
        context: { regression: 'mission-closure' },
      },
    });
    const operationallyClosed = await missions.transition(
      principal(organizationAId, userAId),
      acceptanceMission.id,
      { toStatus: 'OPERATIONALLY_CLOSED' },
    );

    const accountingPolicy = await closurePolicies.save(principal(organizationAId, userAId), {
      clientId: clientAId,
      stage: 'ACCOUNTING_READINESS',
      requirements: [{ documentType: 'WAYBILL', scope: 'MISSION' }],
    });
    await closurePolicies.approve(principal(organizationAId, verifierAId), accountingPolicy.id);
    await closurePolicies.activate(principal(organizationAId, userAId), accountingPolicy.id);
    await expect(
      missions.transition(principal(organizationAId, userAId), acceptanceMission.id, {
        toStatus: 'ACCOUNTING_READY',
      }),
    ).rejects.toThrow('Missing verified WAYBILL document for MISSION');
    const waybill = await documents.upload(
      principal(organizationAId, userAId),
      { missionId: acceptanceMission.id, type: 'WAYBILL' },
      {
        originalname: 'waybill.pdf',
        mimetype: 'application/pdf',
        size: 8,
        buffer: Buffer.from('%PDF-1.7'),
      },
    );
    await documents.recordMalwareScan(principal(organizationAId, verifierAId), waybill.id, {
      status: 'CLEAN',
    });
    await documents.verify(principal(organizationAId, verifierAId), waybill.id, {
      status: 'VERIFIED',
    });
    const accountingReady = await missions.transition(
      principal(organizationAId, userAId),
      acceptanceMission.id,
      { toStatus: 'ACCOUNTING_READY' },
    );
    const closed = await missions.transition(
      principal(organizationAId, userAId),
      acceptanceMission.id,
      { toStatus: 'CLOSED' },
    );
    const timeline = await missions.listEvents(
      principal(organizationAId, userAId),
      acceptanceMission.id,
      { page: 1, limit: 100 },
    );
    const auditCount = await prisma.auditLog.count({
      where: { organizationId: organizationAId, entityId: acceptanceMission.id },
    });
    const daily = await dailyLoading.get(principal(organizationAId, userAId), {
      from: '2026-08-12T00:00:00.000Z',
      to: '2026-08-13T00:00:00.000Z',
      page: 1,
      limit: 25,
    });
    const resolvedClosureException = await prisma.operationalException.findUniqueOrThrow({
      where: { id: closureException.id },
    });
    const closureExceptionAudit = await prisma.auditLog.count({
      where: {
        organizationId: organizationAId,
        entityId: closureException.id,
        action: 'exception.resolved_on_mission_closure',
      },
    });

    expect(delivered.status).toBe('DELIVERED');
    expect(operationallyClosed.status).toBe('OPERATIONALLY_CLOSED');
    expect(accountingReady.status).toBe('ACCOUNTING_READY');
    expect(closed.status).toBe('CLOSED');
    expect(resolvedClosureException).toMatchObject({
      status: 'RESOLVED',
      activeKey: null,
      resolutionNotes: 'Mission operationally closed',
    });
    expect(closureExceptionAudit).toBe(1);
    expect(timeline.data[0]?.eventType).toBe('MISSION_CREATED');
    expect(timeline.data.at(-1)?.eventType).toBe('MISSION_STATUS_CHANGED');
    expect(timeline.meta.total).toBe(19);
    expect(auditCount).toBe(15);
    expect(daily.summary.byStatus.CLOSED).toBe(1);
    expect(daily.data[0]?.stopProgress.completed).toBe(1);
  });

  it('rejects a mission linked to another organization warehouse', async () => {
    await expect(
      prisma.mission.create({
        data: {
          organizationId: organizationAId,
          missionNo: 'INVALID-CROSS-TENANT',
          clientId: clientAId,
          warehouseId: warehouseBId,
        },
      }),
    ).rejects.toThrow();
  });
});
