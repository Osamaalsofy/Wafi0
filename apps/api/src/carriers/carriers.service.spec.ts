jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { CarriersService } from './carriers.service';

describe('CarriersService', () => {
  it('always scopes list queries to the authenticated organization', async () => {
    let listOrganizationId: string | undefined;
    let countOrganizationId: string | undefined;
    let listOrder: Array<Record<string, string>> | undefined;
    const findMany = jest.fn(
      (args: { where: { organizationId?: string }; orderBy: Array<Record<string, string>> }) => {
        listOrganizationId = args.where.organizationId;
        listOrder = args.orderBy;
        return 'find-query';
      },
    );
    const count = jest.fn((args: { where: { organizationId?: string } }) => {
      countOrganizationId = args.where.organizationId;
      return 'count-query';
    });
    const prisma = {
      carrier: { findMany, count },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;

    await new CarriersService(prisma).list(
      {
        userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
        organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
        email: 'admin@example.com',
        grants: [],
      },
      { page: 1, limit: 25, sortBy: 'name', sortOrder: 'asc' },
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    expect(listOrganizationId).toBe('ae1ea62d-0626-4762-88c4-16bd3fddcba9');
    expect(countOrganizationId).toBe('ae1ea62d-0626-4762-88c4-16bd3fddcba9');
    expect(listOrder).toEqual([{ name: 'asc' }, { id: 'asc' }]);
  });
});
