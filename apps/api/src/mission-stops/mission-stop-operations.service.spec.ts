jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { MISSION_EVENT_TYPES } from '../missions/mission.constants';
import type { RuleEvaluatorService } from '../operational-intelligence/rule-evaluator.service';
import { MissionStopOperationsService } from './mission-stop-operations.service';

const principal = {
  userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
  organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
  email: 'operator@example.com',
  grants: [],
};

const ruleEvaluator = {
  evaluateTimeRule: jest.fn().mockResolvedValue(undefined),
  evaluateQuantityRule: jest.fn().mockResolvedValue(undefined),
} as unknown as RuleEvaluatorService;

describe('MissionStopOperationsService', () => {
  it('prevents arrival while an earlier stop is incomplete', async () => {
    const transactionClient = {
      missionStop: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          sequence: 2,
          status: 'PENDING',
        }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await expect(
      new MissionStopOperationsService(prisma, ruleEvaluator).arrive(principal, 'stop-id', {}),
    ).rejects.toThrow('Earlier mission stops must be completed first');
  });

  it('records an arrival event after an optimistic status update', async () => {
    let eventType: string | undefined;
    const occurredAt = new Date('2026-08-10T08:30:00.000Z');
    const transactionClient = {
      missionStop: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          sequence: 1,
          status: 'PENDING',
        }),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          status: 'ARRIVED',
          actualArrival: occurredAt,
        }),
      },
      missionEvent: {
        create: jest.fn((args: { data: { eventType: string } }) => {
          eventType = args.data.eventType;
          return Promise.resolve({ id: 'event-id' });
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      mission: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'mission-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new MissionStopOperationsService(prisma, ruleEvaluator).arrive(
      principal,
      'stop-id',
      {
        occurredAt: occurredAt.toISOString(),
      },
    );

    expect(result.status).toBe('ARRIVED');
    expect(eventType).toBe(MISSION_EVENT_TYPES.stopArrived);
  });

  it('treats a concurrent arrival reaching the same target as idempotent', async () => {
    const createEvent = jest.fn();
    const transactionClient = {
      missionStop: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          sequence: 1,
          status: 'PENDING',
        }),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          status: 'ARRIVED',
        }),
      },
      missionEvent: { create: createEvent },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new MissionStopOperationsService(prisma, ruleEvaluator).arrive(
      principal,
      'stop-id',
      {},
    );

    expect(result.status).toBe('ARRIVED');
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('rejects an unloading timestamp before arrival', async () => {
    const transactionClient = {
      missionStop: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          status: 'ARRIVED',
          actualArrival: new Date('2026-08-10T09:00:00.000Z'),
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await expect(
      new MissionStopOperationsService(prisma, ruleEvaluator).startUnloading(principal, 'stop-id', {
        occurredAt: '2026-08-10T08:59:00.000Z',
      }),
    ).rejects.toThrow('Unloading cannot start before stop arrival');
  });

  it('records supplied quantities without deriving business values', async () => {
    let eventPayload: Record<string, string | null> | undefined;
    const transactionClient = {
      missionStop: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          status: 'UNLOADING',
          unloadingStartedAt: new Date('2026-08-10T09:00:00.000Z'),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'stop-id',
          missionId: 'mission-id',
          status: 'COMPLETED',
          receivedQty: { toString: () => '9' },
          actualQty: { toString: () => '9' },
          rejectedQty: { toString: () => '0.5' },
          shortageQty: { toString: () => '0.5' },
          quantityUnit: 'CARTON',
        }),
      },
      missionEvent: {
        create: jest.fn((args: { data: { payload: Record<string, string | null> } }) => {
          eventPayload = args.data.payload;
          return Promise.resolve({ id: 'event-id' });
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      mission: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'mission-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await new MissionStopOperationsService(prisma, ruleEvaluator).complete(principal, 'stop-id', {
      occurredAt: '2026-08-10T09:30:00.000Z',
      receivedQty: 9,
      rejectedQty: 0.5,
      shortageQty: 0.5,
      unit: 'CARTON',
    });

    expect(eventPayload).toMatchObject({
      receivedQty: '9',
      rejectedQty: '0.5',
      shortageQty: '0.5',
      unit: 'CARTON',
    });
  });
});
