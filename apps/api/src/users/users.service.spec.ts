jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { ForbiddenException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import type { PrismaService } from '../database/prisma.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('creates a client-scoped portal identity with read-only permissions', async () => {
    const organizationId = 'ae1ea62d-0626-4762-88c4-16bd3fddcba9';
    const clientId = '1d3023ce-fe7e-4b17-a737-5799440c5635';
    const assigned = jest.fn().mockResolvedValue({ id: 'assignment-id' });
    const transactionClient = {
      permission: { findMany: jest.fn().mockResolvedValue([
        { id: 'p1', code: 'control_tower.read' }, { id: 'p2', code: 'mission.read' },
        { id: 'p3', code: 'document.read' }, { id: 'p4', code: 'support.read' },
      ]) },
      role: { upsert: jest.fn().mockResolvedValue({ id: 'role-id', code: 'CLIENT_PORTAL_USER' }) },
      rolePermission: { upsert: jest.fn().mockResolvedValue({}) },
      user: { create: jest.fn().mockResolvedValue({ id: 'portal-user', email: 'client@example.com', name: 'Client User' }) },
      userRole: { create: assigned },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: clientId, code: 'CLIENT', name: 'Client' }) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient)),
    } as unknown as PrismaService;

    await new UsersService(prisma).createClientPortalUser(
      { userId: 'admin-id', organizationId, email: 'admin@example.com', grants: [] },
      { clientId, name: 'Client User', email: 'client@example.com', password: 'secure-password-123' },
    );

    expect(assigned).toHaveBeenCalledWith({ data: {
      userId: 'portal-user', roleId: 'role-id', scopeType: 'CLIENT', scopeId: clientId,
    } });
    expect(transactionClient.role.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ code: 'CLIENT_PORTAL_USER' }),
    }));
  });

  it('returns tenant users in deterministic order', async () => {
    let orderBy: Array<Record<string, string>> | undefined;
    const prisma = {
      user: {
        findMany: jest.fn((input: { orderBy: Array<Record<string, string>> }) => {
          orderBy = input.orderBy;
          return [];
        }),
      },
    } as unknown as PrismaService;
    const principal = {
      userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
      organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
      email: 'admin@example.com',
      grants: [],
    } as AuthenticatedPrincipal;

    await new UsersService(prisma).list(principal);

    expect(orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('prevents an administrator from deactivating their own account', async () => {
    const principal = {
      userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
      organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
      email: 'admin@example.com',
      grants: [],
    } as AuthenticatedPrincipal;
    const service = new UsersService({} as PrismaService);

    await expect(
      service.updateStatus(principal, principal.userId, 'INACTIVE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revokes refresh sessions after a password change', async () => {
    const passwordHash = await hash('current-password', 4);
    let revokedAt: Date | undefined;
    const updateMany = jest.fn(
      (input: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
        revokedAt = input.data.revokedAt;
        return Promise.resolve({ count: 2 });
      },
    );
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findUser = jest.fn().mockResolvedValue({
      id: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
      passwordHash,
    });
    const transactionClient = {
      $executeRaw: queryRaw,
      user: { findFirst: findUser, update: jest.fn().mockResolvedValue({ id: 'user-id' }) },
      refreshSession: { updateMany },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<void>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await service.changePassword(
      {
        userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
        organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
        email: 'admin@example.com',
        grants: [],
      },
      'current-password',
      'a-different-password',
    );

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(revokedAt).toBeInstanceOf(Date);
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(findUser.mock.invocationCallOrder[0]);
  });

  it('does not write side effects when the user already has the requested status', async () => {
    const inactiveUser = {
      id: '1d3023ce-fe7e-4b17-a737-5799440c5635',
      organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
      email: 'operator@example.com',
      name: 'Operator',
      status: 'INACTIVE' as const,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const transactionClient = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findFirst: jest.fn().mockResolvedValue(inactiveUser),
        updateMany: jest.fn(),
      },
      refreshSession: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new UsersService(prisma).updateStatus(
      {
        userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
        organizationId: inactiveUser.organizationId,
        email: 'admin@example.com',
        grants: [],
      },
      inactiveUser.id,
      'INACTIVE',
    );

    expect(result).toBe(inactiveUser);
    expect(transactionClient.user.updateMany).not.toHaveBeenCalled();
    expect(transactionClient.refreshSession.updateMany).not.toHaveBeenCalled();
    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });

  it('treats a concurrent change to the same status as idempotent', async () => {
    const activeUser = {
      id: '1d3023ce-fe7e-4b17-a737-5799440c5635',
      organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
      email: 'operator@example.com',
      name: 'Operator',
      status: 'ACTIVE' as const,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const inactiveUser = { ...activeUser, status: 'INACTIVE' as const };
    const transactionClient = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValueOnce(activeUser).mockResolvedValueOnce(inactiveUser),
      },
      refreshSession: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new UsersService(prisma).updateStatus(
      {
        userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
        organizationId: activeUser.organizationId,
        email: 'admin@example.com',
        grants: [],
      },
      activeUser.id,
      'INACTIVE',
    );

    expect(result).toBe(inactiveUser);
    expect(transactionClient.refreshSession.updateMany).not.toHaveBeenCalled();
    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });

  it('does not duplicate an existing organization-role assignment or its audit', async () => {
    const assignment = {
      id: '5a80b80a-471a-4a6c-a5cf-27e5deee32f1',
      userId: '1d3023ce-fe7e-4b17-a737-5799440c5635',
      roleId: '4360ac25-52d1-42f8-a2fc-b096898fd1af',
      scopeType: 'ORGANIZATION' as const,
      scopeId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
      createdAt: new Date(),
    };
    const transactionClient = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: { findFirst: jest.fn().mockResolvedValue({ id: assignment.userId }) },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: assignment.roleId, code: 'OPERATOR' }),
      },
      userRole: {
        findUnique: jest.fn().mockResolvedValue(assignment),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new UsersService(prisma).assignOrganizationRole(
      {
        userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
        organizationId: assignment.scopeId,
        email: 'admin@example.com',
        grants: [],
      },
      assignment.userId,
      assignment.roleId,
    );

    expect(result).toBe(assignment);
    expect(transactionClient.userRole.create).not.toHaveBeenCalled();
    expect(transactionClient.auditLog.create).not.toHaveBeenCalled();
  });
});
