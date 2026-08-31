jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { createHash } from 'node:crypto';
import type { PrismaService } from '../database/prisma.service';
import { KpiFactSnapshotsService } from './kpi-fact-snapshots.service';

const principal = {
  userId: 'user-id',
  organizationId: 'organization-id',
  email: 'operator@example.com',
  grants: [],
};

describe('KpiFactSnapshotsService', () => {
  it('returns an identical immutable snapshot for the same idempotency request', async () => {
    const missionIds = ['00000000-0000-4000-8000-000000000001'];
    const existing = {
      id: 'snapshot-id',
      configurationId: '00000000-0000-4000-8000-000000000002',
      periodDate: new Date('2026-08-21T00:00:00Z'),
      timeZone: 'Asia/Riyadh',
      sourceCutoffAt: new Date('2026-08-21T12:30:00Z'),
      missionSetHash: createHash('sha256').update(JSON.stringify(missionIds)).digest('hex'),
      missionFacts: [],
    };
    const tx = {
      $executeRaw: jest.fn(),
      kpiFactSnapshot: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    const result = await new KpiFactSnapshotsService(prisma).create(principal, {
      configurationId: existing.configurationId,
      idempotencyKey: '00000000-0000-4000-8000-000000000003',
      periodDate: '2026-08-21',
      timeZone: existing.timeZone,
      sourceCutoffAt: existing.sourceCutoffAt.toISOString(),
      missionIds,
    });

    expect(result).toBe(existing);
    expect(tx.kpiFactSnapshot.create).not.toHaveBeenCalled();
  });

  it('rejects current mission state that changed after the requested source cutoff', async () => {
    let configurationWhere: { createdAt?: { lte: Date } } | undefined;
    const createSnapshot = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      kpiFactSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: createSnapshot,
      },
      kpiConfiguration: {
        findFirst: jest.fn((input: { where: { createdAt?: { lte: Date } } }) => {
          configurationWhere = input.where;
          return Promise.resolve({
            id: 'configuration-id',
            scopeType: 'CLIENT',
            scopeId: 'client-id',
          });
        }),
      },
      mission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '00000000-0000-4000-8000-000000000001',
            organizationId: principal.organizationId,
            clientId: 'client-id',
            contractId: null,
            routeId: null,
            warehouseId: 'warehouse-id',
            carrierId: null,
            driverId: null,
            updatedAt: new Date('2026-08-21T12:31:00Z'),
            route: null,
            exceptions: [],
          },
        ]),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await expect(
      new KpiFactSnapshotsService(prisma).create(principal, {
        configurationId: '00000000-0000-4000-8000-000000000002',
        idempotencyKey: '00000000-0000-4000-8000-000000000003',
        periodDate: '2026-08-21',
        timeZone: 'Asia/Riyadh',
        sourceCutoffAt: '2026-08-21T12:30:00Z',
        missionIds: ['00000000-0000-4000-8000-000000000001'],
      }),
    ).rejects.toThrow('Mission state changed after the KPI source cutoff');
    expect(configurationWhere?.createdAt?.lte).toEqual(new Date('2026-08-21T12:30:00Z'));
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it('rejects exception facts detected after the requested source cutoff', async () => {
    const createSnapshot = jest.fn();
    const tx = {
      $executeRaw: jest.fn(),
      kpiFactSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: createSnapshot,
      },
      kpiConfiguration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'configuration-id',
          scopeType: 'CLIENT',
          scopeId: 'client-id',
        }),
      },
      mission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '00000000-0000-4000-8000-000000000001',
            organizationId: principal.organizationId,
            clientId: 'client-id',
            contractId: null,
            routeId: null,
            warehouseId: 'warehouse-id',
            carrierId: null,
            driverId: null,
            updatedAt: new Date('2026-08-21T12:00:00Z'),
            route: null,
            exceptions: [
              {
                updatedAt: new Date('2026-08-21T12:00:00Z'),
                lastDetectedAt: new Date('2026-08-21T12:31:00Z'),
                resolvedAt: null,
              },
            ],
          },
        ]),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    await expect(
      new KpiFactSnapshotsService(prisma).create(principal, {
        configurationId: '00000000-0000-4000-8000-000000000002',
        idempotencyKey: '00000000-0000-4000-8000-000000000003',
        periodDate: '2026-08-21',
        timeZone: 'Asia/Riyadh',
        sourceCutoffAt: '2026-08-21T12:30:00Z',
        missionIds: ['00000000-0000-4000-8000-000000000001'],
      }),
    ).rejects.toThrow('Exception facts changed after the KPI source cutoff');
    expect(createSnapshot).not.toHaveBeenCalled();
  });
});
