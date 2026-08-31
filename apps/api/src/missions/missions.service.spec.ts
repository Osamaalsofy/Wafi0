jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { MISSION_EVENT_TYPES } from './mission.constants';
import { MissionsService } from './missions.service';

const principal = {
  userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
  organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
  email: 'admin@example.com',
  grants: [],
};

describe('MissionsService', () => {
  it('returns tenant-scoped transitions from the authoritative mission policy', async () => {
    const findFirst = jest.fn().mockResolvedValue({ status: 'DRAFT' });
    const prisma = {
      mission: { findFirst },
    } as unknown as PrismaService;

    await expect(
      new MissionsService(prisma).availableTransitions(principal, 'mission-id'),
    ).resolves.toEqual({
      status: 'DRAFT',
      transitions: ['ASSIGNED', 'CANCELLED'],
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'mission-id', organizationId: principal.organizationId },
      select: { status: true },
    });
  });

  it('uses a stable unique tie-breaker for paginated mission events', async () => {
    let eventOrder: Array<Record<string, string>> | undefined;
    const prisma = {
      mission: { findFirst: jest.fn().mockResolvedValue({ id: 'mission-id', stops: [] }) },
      missionEvent: {
        findMany: jest.fn((input: { orderBy: Array<Record<string, string>> }) => {
          eventOrder = input.orderBy;
          return 'events';
        }),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;

    await new MissionsService(prisma).listEvents(principal, 'mission-id', {
      page: 1,
      limit: 25,
    });

    expect(eventOrder).toEqual([{ occurredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('always scopes mission lists to the authenticated organization', async () => {
    let organizationId: string | undefined;
    let missionOrder: Array<Record<string, string>> | undefined;
    const findMany = jest.fn(
      (args: { where: { organizationId?: string }; orderBy: Array<Record<string, string>> }) => {
        organizationId = args.where.organizationId;
        missionOrder = args.orderBy;
        return 'find-query';
      },
    );
    const prisma = {
      mission: { findMany, count: jest.fn().mockReturnValue('count-query') },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;

    await new MissionsService(prisma).list(principal, {
      page: 1,
      limit: 25,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(organizationId).toBe(principal.organizationId);
    expect(missionOrder).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('atomically creates a mission event and audit record with a new mission', async () => {
    let eventType: string | undefined;
    let auditAction: string | undefined;
    const transactionClient = {
      mission: {
        create: jest.fn().mockResolvedValue({
          id: '51ae277f-3265-4712-9f17-3b5121125450',
          missionNo: 'M-001',
          clientId: '7eb3bb30-a7f7-4090-923e-06d795178e74',
          warehouseId: '7a55f96a-ad7e-4fbc-a339-5641a0325858',
          status: 'DRAFT',
        }),
      },
      missionEvent: {
        create: jest.fn((args: { data: { eventType: string } }) => {
          eventType = args.data.eventType;
          return Promise.resolve({ id: 'event-id' });
        }),
      },
      auditLog: {
        create: jest.fn((args: { data: { action: string } }) => {
          auditAction = args.data.action;
          return Promise.resolve({ id: 'audit-id' });
        }),
      },
    };
    const prisma = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse-id' }) },
      mission: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await new MissionsService(prisma).create(principal, {
      missionNo: 'm-001',
      clientId: '7eb3bb30-a7f7-4090-923e-06d795178e74',
      warehouseId: '7a55f96a-ad7e-4fbc-a339-5641a0325858',
    });

    expect(eventType).toBe(MISSION_EVENT_TYPES.created);
    expect(auditAction).toBe('mission.created');
  });

  it('rejects a mission contract that does not belong to its tenant and client', async () => {
    const transaction = jest.fn();
    const prisma = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse-id' }) },
      operationalContract: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(
      new MissionsService(prisma).create(principal, {
        missionNo: 'M-CONTRACT',
        clientId: '7eb3bb30-a7f7-4090-923e-06d795178e74',
        contractId: '51ae277f-3265-4712-9f17-3b5121125450',
        warehouseId: '7a55f96a-ad7e-4fbc-a339-5641a0325858',
      }),
    ).rejects.toThrow('Active contract for mission client not found');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires a mission contract to be effective at the scheduled loading time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T10:00:00Z'));
    let contractWhere:
      | {
          effectiveFrom?: { lte: Date };
          effectiveTo?: { gt: Date };
        }
      | undefined;
    const transaction = jest.fn();
    const prisma = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse-id' }) },
      operationalContract: {
        findFirst: jest.fn(
          (args: {
            where: {
              effectiveFrom?: { lte: Date };
              effectiveTo?: { gt: Date };
            };
          }) => {
            contractWhere = args.where;
            return Promise.resolve(null);
          },
        ),
      },
      $transaction: transaction,
    } as unknown as PrismaService;

    try {
      await expect(
        new MissionsService(prisma).create(principal, {
          missionNo: 'M-FUTURE-CONTRACT',
          clientId: '7eb3bb30-a7f7-4090-923e-06d795178e74',
          contractId: '51ae277f-3265-4712-9f17-3b5121125450',
          warehouseId: '7a55f96a-ad7e-4fbc-a339-5641a0325858',
          scheduledLoadingAt: '2026-08-20T08:00:00Z',
        }),
      ).rejects.toThrow('Active contract for mission client not found');
    } finally {
      jest.useRealTimers();
    }

    expect(contractWhere?.effectiveFrom?.lte).toEqual(new Date('2026-08-20T08:00:00Z'));
    expect(contractWhere?.effectiveTo?.gt).toEqual(new Date('2026-08-20T08:00:00Z'));
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a mission route that is inactive or outside its tenant and client', async () => {
    const transaction = jest.fn();
    const prisma = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse-id' }) },
      operationalRoute: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(
      new MissionsService(prisma).create(principal, {
        missionNo: 'M-ROUTE',
        clientId: '7eb3bb30-a7f7-4090-923e-06d795178e74',
        routeId: '51ae277f-3265-4712-9f17-3b5121125450',
        warehouseId: '7a55f96a-ad7e-4fbc-a339-5641a0325858',
      }),
    ).rejects.toThrow('Active route for mission client not found');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('locks and rereads a tenant mission before editing it', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findMission = jest.fn().mockResolvedValue({
      id: 'mission-id',
      clientId: 'client-id',
      contractId: null,
      routeId: null,
      warehouseId: 'warehouse-id',
      cargoType: null,
      scheduledLoadingAt: null,
      scheduledDepartureAt: null,
      notes: null,
    });
    const tx = {
      $executeRaw: queryRaw,
      mission: {
        findFirst: findMission,
        update: jest.fn().mockResolvedValue({
          id: 'mission-id',
          clientId: 'client-id',
          contractId: null,
          routeId: null,
          warehouseId: 'warehouse-id',
          cargoType: 'Medical',
          scheduledLoadingAt: null,
          scheduledDepartureAt: null,
          notes: null,
        }),
      },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse-id' }) },
      missionEvent: { create: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await new MissionsService(prisma).update(principal, 'mission-id', { cargoType: 'Medical' });

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findMission.mock.invocationCallOrder[0],
    );
    expect(findMission).toHaveBeenCalledWith({
      where: { id: 'mission-id', organizationId: principal.organizationId },
    });
    expect(tx.mission.update).toHaveBeenCalledTimes(1);
  });

  it('allows optional contract and route relationships to be cleared', async () => {
    let updateData: { contractId?: string | null; routeId?: string | null } | undefined;
    const current = {
      id: 'mission-id',
      clientId: 'client-id',
      contractId: 'contract-id',
      routeId: 'route-id',
      warehouseId: 'warehouse-id',
      cargoType: null,
      scheduledLoadingAt: null,
      scheduledDepartureAt: null,
      notes: null,
    };
    const tx = {
      $executeRaw: jest.fn(),
      mission: {
        findFirst: jest.fn().mockResolvedValue(current),
        update: jest.fn(
          (input: { data: { contractId?: string | null; routeId?: string | null } }) => {
            updateData = input.data;
            return Promise.resolve({ ...current, contractId: null, routeId: null });
          },
        ),
      },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse-id' }) },
      missionEvent: { create: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await new MissionsService(prisma).update(principal, 'mission-id', {
      contractId: null,
      routeId: null,
    });

    expect(updateData).toMatchObject({ contractId: null, routeId: null });
  });

  it('validates and audits a carrier assignment without changing mission status', async () => {
    let eventType: string | undefined;
    let updatedStatus: string | undefined;
    const transactionClient = {
      $executeRaw: jest.fn(),
      carrier: { findFirst: jest.fn().mockResolvedValue({ id: 'carrier-id' }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-id' }) },
      driver: { findFirst: jest.fn().mockResolvedValue({ id: 'driver-id' }) },
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          carrierId: null,
          vehicleId: null,
          driverId: null,
        }),
        update: jest.fn((args: { data: { status?: string } }) => {
          updatedStatus = args.data.status;
          return Promise.resolve({ id: 'mission-id', status: 'DRAFT', ...args.data });
        }),
      },
      missionEvent: {
        create: jest.fn((args: { data: { eventType: string } }) => {
          eventType = args.data.eventType;
          return Promise.resolve({ id: 'event-id' });
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await new MissionsService(prisma).assign(principal, '51ae277f-3265-4712-9f17-3b5121125450', {
      carrierId: '7eb3bb30-a7f7-4090-923e-06d795178e74',
      vehicleId: '7a55f96a-ad7e-4fbc-a339-5641a0325858',
      driverId: '57b12fe9-1a33-4568-960f-7eaec0ea21f7',
    });

    expect(eventType).toBe(MISSION_EVENT_TYPES.assignmentChanged);
    expect(updatedStatus).toBeUndefined();
    expect(transactionClient.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transactionClient.mission.findFirst.mock.invocationCallOrder[0],
    );
  });

  it('rejects a vehicle that is not active for the selected carrier', async () => {
    const transactionClient = {
      $executeRaw: jest.fn(),
      carrier: { findFirst: jest.fn().mockResolvedValue({ id: 'carrier-id' }) },
      vehicle: { findFirst: jest.fn().mockResolvedValue(null) },
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          carrierId: null,
          vehicleId: null,
          driverId: null,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await expect(
      new MissionsService(prisma).assign(principal, '51ae277f-3265-4712-9f17-3b5121125450', {
        carrierId: '7eb3bb30-a7f7-4090-923e-06d795178e74',
        vehicleId: '7a55f96a-ad7e-4fbc-a339-5641a0325858',
        driverId: '57b12fe9-1a33-4568-960f-7eaec0ea21f7',
      }),
    ).rejects.toThrow('Active carrier vehicle not found');
  });

  it('transitions an assigned mission atomically and records the event', async () => {
    let eventType: string | undefined;
    const transactionClient = {
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'DRAFT',
          carrierId: 'carrier-id',
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
          stops: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'mission-id', status: 'ASSIGNED' }),
      },
      missionEvent: {
        create: jest.fn((args: { data: { eventType: string } }) => {
          eventType = args.data.eventType;
          return Promise.resolve({ id: 'event-id' });
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new MissionsService(prisma).transition(
      principal,
      '51ae277f-3265-4712-9f17-3b5121125450',
      { toStatus: 'ASSIGNED' },
    );

    expect(result.status).toBe('ASSIGNED');
    expect(eventType).toBe(MISSION_EVENT_TYPES.statusChanged);
  });

  it('treats a concurrent transition to the same target as idempotent', async () => {
    const createEvent = jest.fn();
    const transactionClient = {
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'DRAFT',
          carrierId: 'carrier-id',
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
          stops: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'ASSIGNED',
        }),
      },
      missionEvent: { create: createEvent },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new MissionsService(prisma).transition(
      principal,
      '51ae277f-3265-4712-9f17-3b5121125450',
      { toStatus: 'ASSIGNED' },
    );

    expect(result.status).toBe('ASSIGNED');
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('rejects lifecycle skips and cancellation without a reason', async () => {
    const transactionClient = {
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'DRAFT',
          carrierId: 'carrier-id',
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
          stops: [],
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;
    const service = new MissionsService(prisma);

    await expect(
      service.transition(principal, '51ae277f-3265-4712-9f17-3b5121125450', {
        toStatus: 'LOADING',
      }),
    ).rejects.toThrow('Mission cannot transition from DRAFT to LOADING');
    await expect(
      service.transition(principal, '51ae277f-3265-4712-9f17-3b5121125450', {
        toStatus: 'CANCELLED',
      }),
    ).rejects.toThrow('A cancellation reason is required');
  });

  it('requires every stop to be completed before delivery', async () => {
    const transactionClient = {
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'DELIVERING',
          carrierId: 'carrier-id',
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
          stops: [{ status: 'PENDING' }],
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await expect(
      new MissionsService(prisma).transition(principal, '51ae277f-3265-4712-9f17-3b5121125450', {
        toStatus: 'DELIVERED',
      }),
    ).rejects.toThrow('Every mission stop must be completed before delivery');
  });

  it('rejects a departure time earlier than the recorded loading start', async () => {
    const transactionClient = {
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'LOADED',
          actualLoadingAt: new Date('2026-08-10T09:00:00.000Z'),
          stops: [],
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await expect(
      new MissionsService(prisma).transition(principal, '51ae277f-3265-4712-9f17-3b5121125450', {
        toStatus: 'DEPARTED',
        occurredAt: '2026-08-10T08:59:59.000Z',
      }),
    ).rejects.toThrow('Mission departure cannot precede loading start');
    expect(transactionClient.mission.updateMany).not.toHaveBeenCalled();
  });

  it('blocks operational closure until the document policy exists', async () => {
    const transactionClient = {
      $executeRaw: jest.fn(),
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'DELIVERED',
          organizationId: principal.organizationId,
          clientId: 'client-id',
          carrierId: 'carrier-id',
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
          stops: [{ id: 'stop-id', status: 'COMPLETED' }],
        }),
      },
      closurePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await expect(
      new MissionsService(prisma).transition(principal, '51ae277f-3265-4712-9f17-3b5121125450', {
        toStatus: 'OPERATIONALLY_CLOSED',
      }),
    ).rejects.toThrow('No active OPERATIONAL_CLOSURE policy exists');
  });

  it('atomically resolves active exceptions when a mission is operationally closed', async () => {
    const auditActions: string[] = [];
    let exceptionUpdate: { status?: string; activeKey?: string | null } | undefined;
    const transactionClient = {
      $executeRaw: jest.fn(),
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          status: 'DELIVERED',
          organizationId: principal.organizationId,
          clientId: 'client-id',
          carrierId: 'carrier-id',
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
          stops: [{ id: 'stop-id', status: 'COMPLETED' }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'mission-id', status: 'OPERATIONALLY_CLOSED' }),
      },
      operationalException: {
        findMany: jest.fn().mockResolvedValue([{ id: 'exception-id', resolutionNotes: null }]),
        updateMany: jest.fn((input: { data: { status?: string; activeKey?: string | null } }) => {
          exceptionUpdate = input.data;
          return Promise.resolve({ count: 1 });
        }),
      },
      missionEvent: { create: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      auditLog: {
        create: jest.fn((input: { data: { action: string } }) => {
          auditActions.push(input.data.action);
          return Promise.resolve({ id: 'audit-id' });
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;
    const closureRequirements = {
      assertSatisfied: jest.fn().mockResolvedValue(undefined),
    } as never;

    await new MissionsService(prisma, closureRequirements).transition(principal, 'mission-id', {
      toStatus: 'OPERATIONALLY_CLOSED',
      occurredAt: '2026-08-21T12:00:00Z',
    });

    expect(exceptionUpdate).toMatchObject({ status: 'RESOLVED', activeKey: null });
    expect(auditActions).toEqual(
      expect.arrayContaining(['exception.resolved_on_mission_closure', 'mission.status_changed']),
    );
  });

  it('locks a mission stop collection before validating and adding a stop', async () => {
    const calls: string[] = [];
    const transactionClient = {
      $executeRaw: jest.fn().mockImplementation(() => {
        calls.push('lock');
        return Promise.resolve(1);
      }),
      mission: {
        findFirst: jest.fn().mockImplementation(() => {
          calls.push('mission');
          return Promise.resolve({ id: 'mission-id', clientId: 'client-id' });
        }),
      },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-id' }) },
      missionStop: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'stop-id',
          branchId: 'branch-id',
          sequence: 1,
        }),
      },
      missionEvent: { create: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await new MissionsService(prisma).addStop(principal, 'mission-id', {
      branchId: 'branch-id',
      sequence: 1,
    });

    expect(calls).toEqual(['lock', 'mission']);
    expect(transactionClient.missionStop.findFirst).toHaveBeenCalledWith({
      where: { missionId: 'mission-id', sequence: 1, id: undefined },
      select: { id: true },
    });
  });

  it('locks and rereads a tenant stop before editing it', async () => {
    const calls: string[] = [];
    let updatedNotes: string | undefined;
    const current = {
      id: 'stop-id',
      organizationId: principal.organizationId,
      missionId: 'mission-id',
      branchId: 'branch-id',
      sequence: 1,
      expectedArrival: null,
      expectedQty: null,
      notes: null,
      mission: { id: 'mission-id', clientId: 'client-id' },
    };
    const transactionClient = {
      $executeRaw: jest.fn().mockImplementation(() => {
        calls.push('lock');
        return Promise.resolve(1);
      }),
      missionStop: {
        findFirst: jest.fn().mockImplementation(() => {
          calls.push('reread');
          return Promise.resolve(current);
        }),
        update: jest.fn((input: { data: { notes?: string } }) => {
          updatedNotes = input.data.notes;
          return Promise.resolve({ ...current, notes: 'Updated' });
        }),
      },
      missionEvent: { create: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      missionStop: { findFirst: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await new MissionsService(prisma).updateStop(principal, 'stop-id', { notes: ' Updated ' });

    expect(calls).toEqual(['lock', 'reread']);
    expect(updatedNotes).toBe('Updated');
  });
});
