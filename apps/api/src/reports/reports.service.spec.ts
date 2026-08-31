jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { ReportsService } from './reports.service';

const principal = {
  userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
  organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
  email: 'operator@example.com',
  grants: [],
};
const query = { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' };

describe('ReportsService', () => {
  it('scopes operational report data to the authenticated organization', async () => {
    let organizationId: string | undefined;
    const findMany = jest.fn((args: { where: { organizationId?: string } }) => {
      organizationId = args.where.organizationId;
      return Promise.resolve([]);
    });
    const service = new ReportsService({ mission: { findMany } } as unknown as PrismaService);

    const result = await service.get(principal, 'mission-performance', query);

    expect(organizationId).toBe(principal.organizationId);
    expect(result).toMatchObject({ type: 'mission-performance', summary: { rows: 0 } });
  });

  it('requires the specialized permission for protected report data', async () => {
    const service = new ReportsService({} as PrismaService);
    await expect(service.get(principal, 'audit', query)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses the tenant boundary for audit data after RBAC approval', async () => {
    let organizationId: string | undefined;
    const findMany = jest.fn((args: { where: { organizationId?: string } }) => {
      organizationId = args.where.organizationId;
      return Promise.resolve([]);
    });
    const service = new ReportsService({ auditLog: { findMany } } as unknown as PrismaService);
    const authorized = {
      ...principal,
      grants: [
        {
          permission: 'audit.read',
          scopeType: 'ORGANIZATION' as const,
          scopeId: principal.organizationId,
        },
      ],
    };

    await service.get(authorized, 'audit', query);

    expect(organizationId).toBe(principal.organizationId);
  });
});
