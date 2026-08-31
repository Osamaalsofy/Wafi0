jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { RoutesService } from './routes.service';

const principal = {
  userId: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000002',
  email: 'operator@example.com',
  grants: [],
};

describe('RoutesService', () => {
  it('always scopes route lists to the authenticated organization', async () => {
    let organizationId: string | undefined;
    let stopOrder: { sequence: 'asc' } | undefined;
    let routeOrder: Array<Record<string, string>> | undefined;
    const prisma = {
      operationalRoute: {
        findMany: jest.fn(
          (args: {
            where: { organizationId?: string };
            include: { stops: { orderBy: { sequence: 'asc' } } };
            orderBy: Array<Record<string, string>>;
          }) => {
            organizationId = args.where.organizationId;
            stopOrder = args.include.stops.orderBy;
            routeOrder = args.orderBy;
            return 'routes';
          },
        ),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;

    await new RoutesService(prisma).list(principal, { page: 1, limit: 25 });

    expect(organizationId).toBe(principal.organizationId);
    expect(stopOrder).toEqual({ sequence: 'asc' });
    expect(routeOrder).toEqual([{ name: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('rejects route stops outside the active tenant client', async () => {
    const transaction = jest.fn();
    const prisma = {
      operationalRoute: { findUnique: jest.fn().mockResolvedValue(null) },
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-id' }) },
      branch: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(
      new RoutesService(prisma).create(principal, {
        clientId: '00000000-0000-4000-8000-000000000003',
        code: 'RIYADH_DAILY',
        name: 'Riyadh daily route',
        cityRegion: 'Riyadh',
        timeZone: 'Asia/Riyadh',
        stops: [{ branchId: '00000000-0000-4000-8000-000000000004', sequence: 1 }],
      }),
    ).rejects.toThrow('Every route stop must reference an active branch for the client');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate stop sequences', async () => {
    const prisma = {} as PrismaService;
    await expect(
      new RoutesService(prisma).create(principal, {
        clientId: '00000000-0000-4000-8000-000000000003',
        code: 'RIYADH_DAILY',
        name: 'Riyadh daily route',
        cityRegion: 'Riyadh',
        timeZone: 'Asia/Riyadh',
        stops: [
          { branchId: '00000000-0000-4000-8000-000000000004', sequence: 1 },
          { branchId: '00000000-0000-4000-8000-000000000005', sequence: 1 },
        ],
      }),
    ).rejects.toThrow('Route stop sequences must be unique');
  });

  it('rejects a non-Saudi timezone for a Saudi operational route', async () => {
    const prisma = {} as PrismaService;
    await expect(
      new RoutesService(prisma).create(principal, {
        clientId: '00000000-0000-4000-8000-000000000003',
        code: 'RIYADH_DAILY',
        name: 'Riyadh daily route',
        cityRegion: 'Riyadh',
        timeZone: 'UTC',
        stops: [{ branchId: '00000000-0000-4000-8000-000000000004', sequence: 1 }],
      }),
    ).rejects.toThrow('Saudi operational routes must use Asia/Riyadh');
  });
});
