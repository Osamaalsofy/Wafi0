jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { KpiConfigurationsService } from './kpi-configurations.service';

describe('KpiConfigurationsService', () => {
  it('returns tenant-scoped registry options with internal calculation enabled', async () => {
    const findClients = jest.fn().mockReturnValue('clients');
    const findContracts = jest.fn().mockReturnValue('contracts');
    const prisma = {
      kpiDefinition: { findMany: jest.fn().mockReturnValue('definitions') },
      client: { findMany: findClients },
      warehouse: { findMany: jest.fn().mockReturnValue('warehouses') },
      carrier: { findMany: jest.fn().mockReturnValue('carriers') },
      operationalContract: { findMany: findContracts },
      driver: { findMany: jest.fn().mockReturnValue('drivers') },
      $transaction: jest.fn().mockResolvedValue([[], [], [], [], [], []]),
    } as unknown as PrismaService;

    const result = await new KpiConfigurationsService(prisma).options({
      userId: 'user-id',
      organizationId: 'organization-id',
      email: 'operator@example.com',
      grants: [],
    });

    expect(findClients).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'organization-id', status: 'ACTIVE' } }),
    );
    expect(result.calculationAvailable).toBe(true);
    expect(findContracts).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'organization-id', status: 'ACTIVE' } }),
    );
    expect(result.unsupportedScopes).toEqual(['ROUTE']);
  });

  it('requires a tenant contract scope to cover the KPI effective start', async () => {
    let contractWhere: { effectiveFrom?: { lte: Date }; effectiveTo?: { gt: Date } } | undefined;
    const prisma = {
      kpiDefinition: { findUnique: jest.fn().mockResolvedValue({ code: 'EXCEPTION_RATE' }) },
      operationalContract: {
        findFirst: jest.fn(
          (input: { where: { effectiveFrom?: { lte: Date }; effectiveTo?: { gt: Date } } }) => {
            contractWhere = input.where;
            return Promise.resolve(null);
          },
        ),
      },
    } as unknown as PrismaService;

    await expect(
      new KpiConfigurationsService(prisma).create(
        {
          userId: 'user-id',
          organizationId: '00000000-0000-4000-8000-000000000001',
          email: 'operator@example.com',
          grants: [],
        },
        {
          kpiCode: 'EXCEPTION_RATE',
          scopeType: 'CONTRACT',
          scopeId: '00000000-0000-4000-8000-000000000002',
          isEnabled: false,
          effectiveFrom: '2026-08-15T00:00:00.000Z',
        },
      ),
    ).rejects.toThrow('Active contract scope not found');
    expect(contractWhere?.effectiveFrom?.lte).toEqual(new Date('2026-08-15T00:00:00.000Z'));
    expect(contractWhere?.effectiveTo?.gt).toEqual(new Date('2026-08-15T00:00:00.000Z'));
  });

  it('locks the scope before selecting the next version', async () => {
    const principal = {
      userId: 'user-id',
      organizationId: '00000000-0000-4000-8000-000000000001',
      email: 'operator@example.com',
      grants: [],
    };
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ version: 2 });
    let createdDefaults: { targetPercent?: number; calculationFrequency?: string } | undefined;
    const create = jest.fn((input: { data: typeof createdDefaults }) => {
      createdDefaults = input.data;
      return Promise.resolve({
        id: 'configuration-id',
        kpiCode: 'EXCEPTION_RATE',
        scopeType: 'ORGANIZATION',
        scopeId: principal.organizationId,
        version: 3,
        isEnabled: false,
        formula: null,
        eligibility: null,
        dataSources: null,
        periodDefinition: null,
        targets: null,
        targetPercent: { toString: () => '90' },
        roundingMode: null,
        decimalScale: null,
        calculationFrequency: 'DAILY',
        timeZone: null,
        effectiveFrom: new Date('2026-09-01T00:00:00Z'),
        effectiveTo: null,
      });
    });
    const tx = {
      $executeRaw: queryRaw,
      kpiConfiguration: { findFirst, create },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const transaction = jest.fn(
      (callback: (client: typeof tx) => Promise<unknown>, options?: { isolationLevel: string }) => {
        void options;
        return callback(tx);
      },
    );
    const prisma = {
      kpiDefinition: { findUnique: jest.fn().mockResolvedValue({ code: 'EXCEPTION_RATE' }) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await new KpiConfigurationsService(prisma).create(principal, {
      kpiCode: 'EXCEPTION_RATE',
      scopeType: 'ORGANIZATION',
      scopeId: principal.organizationId,
      isEnabled: false,
      effectiveFrom: '2026-09-01T00:00:00Z',
    });

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findFirst.mock.invocationCallOrder[0],
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(createdDefaults).toMatchObject({ targetPercent: 90, calculationFrequency: 'DAILY' });
    expect(transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: 'ReadCommitted' });
  });
});
