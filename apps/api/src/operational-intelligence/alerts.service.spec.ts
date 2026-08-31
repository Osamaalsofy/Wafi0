jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { ExceptionsService } from './exceptions.service';

const principal = {
  userId: 'user-id',
  organizationId: 'organization-id',
  email: 'operator@example.com',
  grants: [],
};

describe('Alerts workflow', () => {
  it('returns exception workflow history and alert escalations chronologically', async () => {
    let exceptionInclude: Record<string, unknown> | undefined;
    let exceptionOrder: Array<Record<string, string>> | undefined;
    let alertInclude: Record<string, unknown> | undefined;
    let alertOrder: Array<Record<string, string>> | undefined;
    const prisma = {
      operationalException: {
        findFirst: jest.fn((input: { include: Record<string, unknown> }) => {
          exceptionInclude = input.include;
          return Promise.resolve({ id: 'exception-id' });
        }),
        findMany: jest.fn((input: { orderBy: Array<Record<string, string>> }) => {
          exceptionOrder = input.orderBy;
          return 'exceptions';
        }),
        count: jest.fn().mockReturnValue('count'),
      },
      alert: {
        findMany: jest.fn(
          (input: { include: Record<string, unknown>; orderBy: Array<Record<string, string>> }) => {
            alertInclude = input.include;
            alertOrder = input.orderBy;
            return 'alerts';
          },
        ),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0, 0]),
    } as unknown as PrismaService;
    const service = new ExceptionsService(prisma);

    await service.get(principal, 'exception-id');
    await service.list(principal, { page: 1, limit: 25 });
    await service.listAlerts(principal, { page: 1, limit: 25, unreadOnly: false });

    expect(exceptionInclude).toMatchObject({
      affectedStops: { orderBy: { stop: { sequence: 'asc' } } },
      evidence: { orderBy: [{ createdAt: 'asc' }, { documentId: 'asc' }] },
      rootCauses: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      decisions: {
        orderBy: [{ decidedAt: 'asc' }, { id: 'asc' }],
        include: {
          actions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
      },
    });
    expect(alertInclude).toMatchObject({
      deliveryAttempts: { orderBy: { attemptNo: 'asc' } },
      escalations: { orderBy: [{ escalatedAt: 'asc' }, { id: 'asc' }] },
    });
    expect(exceptionOrder).toEqual([
      { lastDetectedAt: 'desc' },
      { openedAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(alertOrder).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('marks a tenant alert as read without overwriting email delivery state', async () => {
    const findAlert = jest.fn().mockResolvedValue({
      id: 'alert-id',
      organizationId: 'organization-id',
      exceptionId: 'exception-id',
      status: 'SENT',
      readAt: null,
    });
    const updatedAlert = {
      id: 'alert-id',
      exceptionId: 'exception-id',
      status: 'SENT',
      readAt: new Date('2026-08-10T10:00:00Z'),
    };
    const updateAlerts = jest
      .fn<
        Promise<{ count: number }>,
        [{ where: { id: string; readAt: null }; data: { readAt: Date } }]
      >()
      .mockResolvedValue({ count: 1 });
    const createAudit = jest
      .fn<Promise<{ id: string }>, [{ data: { action: string; actorUserId: string } }]>()
      .mockResolvedValue({ id: 'audit-id' });
    const transactionClient = {
      alert: {
        updateMany: updateAlerts,
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedAlert),
      },
      auditLog: { create: createAudit },
    };
    const prisma = {
      alert: { findFirst: findAlert },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new ExceptionsService(prisma).markAlertRead(principal, 'alert-id');

    expect(findAlert).toHaveBeenCalledWith({
      where: { id: 'alert-id', organizationId: 'organization-id' },
    });
    expect(result.status).toBe('SENT');
    expect(updateAlerts.mock.calls[0]?.[0].where).toEqual({ id: 'alert-id', readAt: null });
    expect(updateAlerts.mock.calls[0]?.[0].data.readAt).toBeInstanceOf(Date);
    expect(createAudit.mock.calls[0]?.[0].data).toMatchObject({
      action: 'alert.read',
      actorUserId: 'user-id',
      newValues: { deliveryStatus: 'SENT' },
    });
  });

  it('keeps completed corrective actions linked to exception audit context', async () => {
    const findAction = jest.fn().mockResolvedValue({
      id: 'action-id',
      organizationId: 'organization-id',
      status: 'OPEN',
      decision: { exceptionId: 'exception-id' },
    });
    const updatedAction = {
      id: 'action-id',
      status: 'COMPLETED',
      completionNotes: 'Completed safely',
    };
    const updateActions = jest.fn().mockResolvedValue({ count: 1 });
    const createAudit = jest
      .fn<Promise<{ id: string }>, [{ data: { newValues: { exceptionId: string } } }]>()
      .mockResolvedValue({ id: 'audit-id' });
    const transactionClient = {
      correctiveAction: {
        updateMany: updateActions,
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedAction),
      },
      auditLog: { create: createAudit },
    };
    const prisma = {
      correctiveAction: { findFirst: findAction },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await new ExceptionsService(prisma).completeAction(principal, 'action-id', {
      notes: 'Completed safely',
    });

    expect(createAudit.mock.calls[0]?.[0].data.newValues.exceptionId).toBe('exception-id');
  });

  it('does not duplicate alert-read audit when another request wins the transition', async () => {
    const current = {
      id: 'alert-id',
      organizationId: 'organization-id',
      exceptionId: 'exception-id',
      status: 'PENDING',
      readAt: null,
    };
    const updated = { ...current, readAt: new Date('2026-08-10T10:00:00Z') };
    const createAudit = jest.fn();
    const transactionClient = {
      alert: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      auditLog: { create: createAudit },
    };
    const prisma = {
      alert: { findFirst: jest.fn().mockResolvedValue(current) },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new ExceptionsService(prisma).markAlertRead(principal, 'alert-id');

    expect(result.status).toBe('PENDING');
    expect(createAudit).not.toHaveBeenCalled();
  });

  it('does not duplicate resolution audit when another request wins the transition', async () => {
    const current = {
      id: 'exception-id',
      organizationId: 'organization-id',
      status: 'OPEN',
      activeKey: 'active-key',
      resolutionNotes: null,
    };
    const resolved = {
      ...current,
      status: 'RESOLVED',
      activeKey: null,
      resolutionNotes: 'Resolved once',
    };
    const createAudit = jest.fn();
    const transactionClient = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      operationalException: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(resolved),
      },
      auditLog: { create: createAudit },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new ExceptionsService(prisma).resolve(principal, 'exception-id', {
      notes: 'Concurrent resolution',
    });

    expect(result.status).toBe('RESOLVED');
    expect(createAudit).not.toHaveBeenCalled();
  });

  it('locks an exception before reading the old owner used by audit', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findException = jest.fn().mockResolvedValue({
      id: 'exception-id',
      organizationId: 'organization-id',
      ownerUserId: 'owner-a',
    });
    const updateException = jest.fn().mockResolvedValue({
      id: 'exception-id',
      ownerUserId: null,
    });
    const createAudit = jest
      .fn<Promise<{ id: string }>, [{ data: { newValues: { oldOwnerUserId: string | null } } }]>()
      .mockResolvedValue({ id: 'audit-id' });
    const transactionClient = {
      $executeRaw: queryRaw,
      operationalException: { findFirst: findException, update: updateException },
      auditLog: { create: createAudit },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    await new ExceptionsService(prisma).assign(principal, 'exception-id', {});

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findException.mock.invocationCallOrder[0],
    );
    expect(createAudit.mock.calls[0]?.[0].data.newValues.oldOwnerUserId).toBe('owner-a');
  });
});
