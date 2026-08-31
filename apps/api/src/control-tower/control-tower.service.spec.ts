jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { ControlTowerService } from './control-tower.service';

describe('ControlTowerService', () => {
  it('scopes active missions and reports exact missing stop documents', async () => {
    let organizationId: string | undefined;
    let missionWhere: Record<string, unknown> | undefined;
    const findActiveClients = jest.fn().mockReturnValue('clients-query');
    const prisma = {
      mission: {
        findMany: jest.fn((args: { where: { organizationId?: string } }) => {
          organizationId = args.where.organizationId;
          missionWhere = args.where;
          return 'missions-query';
        }),
        count: jest.fn().mockReturnValue('count-query'),
        groupBy: jest.fn().mockReturnValue('group-query'),
      },
      client: { findMany: findActiveClients },
      warehouse: { findMany: jest.fn().mockReturnValue('warehouses-query') },
      carrier: { findMany: jest.fn().mockReturnValue('carriers-query') },
      driver: { findMany: jest.fn().mockReturnValue('drivers-query') },
      operationalException: { count: jest.fn().mockReturnValue('exception-count-query') },
      $transaction: jest.fn().mockResolvedValue([
        [
          {
            id: 'mission-id',
            missionNo: 'M-001',
            status: 'DELIVERED',
            client: {
              id: 'client-id',
              code: 'CLIENT',
              name: 'Client',
              closurePolicies: [
                {
                  stage: 'OPERATIONAL_CLOSURE',
                  requirements: [{ documentType: 'POD', scope: 'EACH_STOP' }],
                },
              ],
            },
            stops: [{ id: 'stop-id', sequence: 1, status: 'COMPLETED' }],
            documents: [],
            exceptions: [],
          },
        ],
        1,
        [{ status: 'DELIVERED', _count: { _all: 1 } }],
        [{ id: 'client-id', code: 'CLIENT', name: 'Client' }],
        [
          {
            id: 'warehouse-id',
            clientId: 'client-id',
            code: 'WH',
            name: 'Warehouse',
          },
        ],
        [{ id: 'carrier-id', code: 'CARRIER', name: 'Carrier' }],
        [{ id: 'driver-id', clientId: 'client-id', name: 'Driver', phone: null, trackingNumber: 'TRK-1', carrier: { id: 'carrier-id', code: 'CARRIER', name: 'Carrier' } }],
        2,
        1,
      ]),
    } as unknown as PrismaService;

    const result = await new ControlTowerService(prisma).get(
      {
        userId: 'user-id',
        organizationId: 'organization-id',
        email: 'a@example.com',
        grants: [{ permission: 'control_tower.read', scopeType: 'ORGANIZATION', scopeId: 'organization-id' }],
      },
      {
        page: 1,
        limit: 25,
        clientId: 'client-id',
        warehouseId: 'warehouse-id',
        carrierId: 'carrier-id',
      },
    );

    expect(organizationId).toBe('organization-id');
    expect(missionWhere).toMatchObject({
      organizationId: 'organization-id',
      clientId: 'client-id',
      warehouseId: 'warehouse-id',
      carrierId: 'carrier-id',
    });
    expect(result.summary.totalActive).toBe(1);
    expect(result.summary.byStatus.DELIVERED).toBe(1);
    expect(result.summary.pageRequiringDocumentAttention).toBe(1);
    expect(result.summary.openExceptions).toBe(2);
    expect(result.summary.criticalExceptions).toBe(1);
    expect(result.data[0]?.closureReadiness).toMatchObject({
      applicable: true,
      policyConfigured: true,
      ready: false,
      missing: [{ documentType: 'POD', scope: 'EACH_STOP', missingStopIds: ['stop-id'] }],
    });
    expect(result.filterOptions).toEqual({
      clients: [{ id: 'client-id', code: 'CLIENT', name: 'Client' }],
      warehouses: [{ id: 'warehouse-id', clientId: 'client-id', code: 'WH', name: 'Warehouse' }],
      carriers: [{ id: 'carrier-id', code: 'CARRIER', name: 'Carrier' }],
      drivers: [{ id: 'driver-id', clientId: 'client-id', name: 'Driver', phone: null, trackingNumber: 'TRK-1', carrier: { id: 'carrier-id', code: 'CARRIER', name: 'Carrier' } }],
    });
    expect(findActiveClients).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'organization-id', status: 'ACTIVE' } }),
    );
  });
});
