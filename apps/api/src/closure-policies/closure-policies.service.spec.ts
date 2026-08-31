jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { ClosurePoliciesService } from './closure-policies.service';

const principal = {
  userId: 'user-id',
  organizationId: 'organization-id',
  email: 'operator@example.com',
  grants: [],
};

describe('ClosurePoliciesService', () => {
  it('locks and refuses to overwrite an existing draft version', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findPolicy = jest.fn().mockResolvedValue({
      id: 'policy-id',
      organizationId: 'organization-id',
      isActive: false,
      status: 'DRAFT',
      version: 2,
      requirements: [],
    });
    const tx = {
      $executeRaw: queryRaw,
      closurePolicy: { findFirst: findPolicy },
      closureDocumentRequirement: { deleteMany: jest.fn() },
    };
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-id' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await expect(
      new ClosurePoliciesService(prisma).save(principal, {
        clientId: 'client-id',
        stage: 'OPERATIONAL_CLOSURE',
        requirements: [],
      }),
    ).rejects.toThrow('A draft version already exists');

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findPolicy.mock.invocationCallOrder[0],
    );
    expect(tx.closureDocumentRequirement.deleteMany).not.toHaveBeenCalled();
  });

  it('locks and rereads activation state before changing a policy', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findPolicy = jest.fn().mockResolvedValue({
      id: 'policy-id',
      isActive: false,
      status: 'APPROVED',
      clientId: 'client-id',
      stage: 'OPERATIONAL_CLOSURE',
      approvedByUserId: 'approver',
      approvedAt: new Date(),
    });
    const updatePolicy = jest.fn().mockResolvedValue({
      id: 'policy-id',
      isActive: true,
      activatedAt: new Date('2026-08-12T10:00:00Z'),
    });
    const tx = {
      $executeRaw: queryRaw,
      closurePolicy: {
        findFirst: findPolicy,
        update: updatePolicy,
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await new ClosurePoliciesService(prisma).activate(principal, 'policy-id');

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findPolicy.mock.invocationCallOrder[0],
    );
    expect(findPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'policy-id', organizationId: 'organization-id' } }),
    );
    expect(updatePolicy).toHaveBeenCalledTimes(1);
  });

  it('does not audit an activation state that already matches', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      closurePolicy: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'policy-id', isActive: true, status: 'ACTIVE' }),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await new ClosurePoliciesService(prisma).activate(principal, 'policy-id');

    expect(tx.closurePolicy.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
