jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { AlertOperationsService } from './alert-operations.service';

const principal = {
  userId: 'user-id',
  organizationId: 'organization-id',
  email: 'fleet@example.com',
  grants: [],
};

describe('AlertOperationsService', () => {
  it('schedules one retry exactly five minutes after the first failed email attempt', async () => {
    let createdData: { attemptNo: number; nextAttemptAt: Date | null } | undefined;
    const tx = {
      $executeRaw: jest.fn(),
      alert: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'alert-id',
          createdAt: new Date('2026-08-10T09:59:00Z'),
          deliveryAttempts: [],
        }),
        update: jest.fn().mockResolvedValue({ id: 'alert-id' }),
      },
      alertDeliveryAttempt: {
        create: jest.fn((input: { data: { attemptNo: number; nextAttemptAt: Date | null } }) => {
          createdData = input.data;
          return Promise.resolve({
            id: 'attempt-id',
            ...input.data,
            outcome: 'FAILED',
            attemptedAt: new Date('2026-08-10T10:00:00Z'),
            error: 'failed',
          });
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await new AlertOperationsService(prisma).recordDeliveryAttempt(principal, 'alert-id', 1, {
      outcome: 'FAILED',
      attemptedAt: '2026-08-10T10:00:00Z',
      error: 'failed',
    });

    expect(createdData).toMatchObject({
      attemptNo: 1,
      nextAttemptAt: new Date('2026-08-10T10:05:00Z'),
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a delivery attempt recorded before the alert existed', async () => {
    const createAttempt = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      alert: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'alert-id',
          createdAt: new Date('2026-08-10T10:00:00Z'),
          deliveryAttempts: [],
        }),
      },
      alertDeliveryAttempt: { create: createAttempt },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await expect(
      new AlertOperationsService(prisma).recordDeliveryAttempt(principal, 'alert-id', 1, {
        outcome: 'SENT',
        attemptedAt: '2026-08-10T09:59:59Z',
      }),
    ).rejects.toThrow('Alert delivery attempt cannot precede alert creation');
    expect(createAttempt).not.toHaveBeenCalled();
  });

  it('does not mark due alerts escalated when no Fleet Manager is configured', async () => {
    const transaction = jest.fn();
    const prisma = {
      alert: { findMany: jest.fn().mockResolvedValue([{ id: 'alert-id' }]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: transaction,
    } as unknown as PrismaService;

    const result = await new AlertOperationsService(prisma).escalateDue(principal, {
      evaluatedAt: '2026-08-10T10:14:00Z',
      limit: 25,
    });

    expect(result).toMatchObject({ escalated: 0, skippedNoFleetManager: 1 });
    expect(transaction).not.toHaveBeenCalled();
  });
});
