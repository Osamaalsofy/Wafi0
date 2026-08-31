jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { RouteDeviationsService } from './route-deviations.service';

const principal = {
  userId: 'user-id',
  organizationId: 'organization-id',
  email: 'fleet@example.com',
  grants: [],
};

describe('RouteDeviationsService', () => {
  it('returns the active incident without creating duplicate history or alerts', async () => {
    const existing = { id: 'incident-id', status: 'OPEN', alerts: [{ id: 'alert-id' }] };
    const tx = {
      $executeRaw: jest.fn(),
      mission: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mission-id',
          organizationId: principal.organizationId,
          clientId: 'client-id',
          routeId: 'route-id',
          warehouseId: 'warehouse-id',
          carrierId: null,
          vehicleId: null,
          driverId: 'driver-id',
        }),
      },
      operationalException: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
      missionEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    const result = await new RouteDeviationsService(prisma).start(principal, 'mission-id', {
      occurredAt: '2026-08-21T10:01:00Z',
    });

    expect(result).toBe(existing);
    expect(tx.operationalException.create).not.toHaveBeenCalled();
    expect(tx.missionEvent.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('recovers an incident once and records its deterministic duration', async () => {
    let updateData:
      { delayMinutes?: number; status?: string; activeKey?: string | null } | undefined;
    const incident = {
      id: 'incident-id',
      status: 'OPEN',
      openedAt: new Date('2026-08-21T10:00:00Z'),
      routeId: 'route-id',
      alerts: [{ id: 'alert-id' }],
    };
    const updated = { ...incident, status: 'RESOLVED', delayMinutes: 8 };
    const tx = {
      $executeRaw: jest.fn(),
      operationalException: {
        findFirst: jest.fn().mockResolvedValue(incident),
        updateMany: jest.fn(
          (input: {
            data: { delayMinutes?: number; status?: string; activeKey?: string | null };
          }) => {
            updateData = input.data;
            return Promise.resolve({ count: 1 });
          },
        ),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      missionEvent: { create: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    const result = await new RouteDeviationsService(prisma).recover(
      principal,
      'mission-id',
      incident.id,
      { returnedAt: '2026-08-21T10:08:00Z' },
    );

    expect(result).toBe(updated);
    expect(updateData).toMatchObject({ delayMinutes: 8, status: 'RESOLVED', activeKey: null });
    expect(tx.missionEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
  });
});
