jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));
import type { PrismaService } from '../database/prisma.service';
import { DriversService } from './drivers.service';

describe('DriversService', () => {
  it('uses a stable unique tie-breaker for paginated drivers', async () => {
    let listOrder: Array<Record<string, string>> | undefined;
    const prisma = {
      driver: {
        findMany: jest.fn((input: { orderBy: Array<Record<string, string>> }) => {
          listOrder = input.orderBy;
          return 'drivers';
        }),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;

    await new DriversService(prisma).list(
      {
        userId: 'user-id',
        organizationId: 'organization-id',
        email: 'admin@example.com',
        grants: [],
      },
      { page: 1, limit: 25, sortBy: 'name', sortOrder: 'asc' },
    );

    expect(listOrder).toEqual([{ name: 'asc' }, { id: 'asc' }]);
  });

  it('rejects a carrier outside the authenticated organization', async () => {
    const prisma = {
      carrier: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(
      new DriversService(prisma).create(
        {
          userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
          organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
          email: 'admin@example.com',
          grants: [],
        },
        { carrierId: 'a6178dd3-aaee-47f8-9765-13e25d0e38d6', name: 'Driver A' },
      ),
    ).rejects.toThrow('Active carrier not found');
  });
});
