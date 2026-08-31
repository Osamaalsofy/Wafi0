jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  it('locks and rereads a tenant role before replacing its permissions', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findRole = jest.fn().mockResolvedValue({
      id: 'role-id',
      organizationId: 'organization-id',
      permissions: [{ permission: { code: 'mission.read' } }],
    });
    const deletePermissions = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $executeRaw: queryRaw,
      role: {
        findFirst: findRole,
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'role-id', permissions: [] }),
      },
      rolePermission: { deleteMany: deletePermissions, createMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      permission: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await new RolesService(prisma).setPermissions(
      {
        userId: 'user-id',
        organizationId: 'organization-id',
        email: 'admin@example.com',
        grants: [],
      },
      'role-id',
      [],
    );

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(findRole.mock.invocationCallOrder[0]);
    expect(findRole).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'role-id', organizationId: 'organization-id' } }),
    );
    expect(deletePermissions).toHaveBeenCalledWith({ where: { roleId: 'role-id' } });
  });

  it('rejects unknown permission codes', async () => {
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(null) },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await expect(
      service.create(
        {
          userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
          organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
          email: 'admin@example.com',
          grants: [],
        },
        { code: 'TEST_ROLE', name: 'Test role', permissionCodes: ['unknown.permission'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
