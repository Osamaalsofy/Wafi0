jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { AuditController } from './audit.controller';

describe('AuditController context', () => {
  it('uses a stable unique tie-breaker for audit feeds', async () => {
    const orders: Array<Array<Record<string, string>>> = [];
    const findMany = jest.fn(
      (input: { orderBy: Array<Record<string, string>> }): Promise<unknown[]> => {
        orders.push(input.orderBy);
        return Promise.resolve([]);
      },
    );
    const controller = new AuditController({ auditLog: { findMany } } as unknown as PrismaService);
    const principal = {
      userId: 'user-id',
      organizationId: 'organization-id',
      email: 'auditor@example.com',
      grants: [],
    };

    await controller.list(principal, 1, 25);
    await controller.context(principal, {
      contextType: 'MISSION',
      contextId: '11111111-1111-4111-8111-111111111111',
    });

    expect(orders).toEqual([
      [{ createdAt: 'desc' }, { id: 'desc' }],
      [{ createdAt: 'desc' }, { id: 'desc' }],
    ]);
  });

  it.each([
    ['EXCEPTION', 'OperationalException'],
    ['RULE_CONFIGURATION', 'RuleConfiguration'],
    ['KPI_CONFIGURATION', 'KpiConfiguration'],
    ['CONTRACT', 'OperationalContract'],
    ['ROUTE', 'OperationalRoute'],
    ['MISSION', 'Mission'],
    ['ALERT', 'Alert'],
  ] as const)(
    'maps %s audit context records within the tenant',
    async (contextType, entityType) => {
      const findMany = jest
        .fn<
          Promise<unknown[]>,
          [{ where: { organizationId: string; OR: Array<Record<string, unknown>> } }]
        >()
        .mockResolvedValue([]);
      const prisma = { auditLog: { findMany } } as unknown as PrismaService;

      await new AuditController(prisma).context(
        {
          userId: 'user-id',
          organizationId: 'organization-id',
          email: 'auditor@example.com',
          grants: [],
        },
        { contextType, contextId: '11111111-1111-4111-8111-111111111111' },
      );

      const where = findMany.mock.calls[0]?.[0].where;
      expect(where?.organizationId).toBe('organization-id');
      expect(where?.OR).toContainEqual({
        entityType,
        entityId: '11111111-1111-4111-8111-111111111111',
      });
    },
  );

  it.each([
    ['EXCEPTION', 'exceptionId'],
    ['MISSION', 'missionId'],
    ['ROUTE', 'routeId'],
  ] as const)('includes %s audit records related by %s', async (contextType, path) => {
    const findMany = jest
      .fn<
        Promise<unknown[]>,
        [{ where: { organizationId: string; OR: Array<Record<string, unknown>> } }]
      >()
      .mockResolvedValue([]);
    const prisma = { auditLog: { findMany } } as unknown as PrismaService;

    await new AuditController(prisma).context(
      {
        userId: 'user-id',
        organizationId: 'organization-id',
        email: 'auditor@example.com',
        grants: [],
      },
      { contextType, contextId: '11111111-1111-4111-8111-111111111111' },
    );

    expect(findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      newValues: { path: [path], equals: '11111111-1111-4111-8111-111111111111' },
    });
  });

  it('includes rule and KPI configuration changes in contract audit context', async () => {
    const findMany = jest
      .fn<
        Promise<unknown[]>,
        [{ where: { organizationId: string; OR: Array<Record<string, unknown>> } }]
      >()
      .mockResolvedValue([]);
    const prisma = { auditLog: { findMany } } as unknown as PrismaService;

    await new AuditController(prisma).context(
      {
        userId: 'user-id',
        organizationId: 'organization-id',
        email: 'auditor@example.com',
        grants: [],
      },
      { contextType: 'CONTRACT', contextId: '11111111-1111-4111-8111-111111111111' },
    );

    expect(findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      AND: [
        { newValues: { path: ['scopeType'], equals: 'CONTRACT' } },
        {
          newValues: {
            path: ['scopeId'],
            equals: '11111111-1111-4111-8111-111111111111',
          },
        },
      ],
    });
  });
});
