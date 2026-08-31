jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { RuleConfigurationsService } from './rule-configurations.service';

describe('RuleConfigurationsService', () => {
  const principal = {
    userId: 'user-id',
    organizationId: '00000000-0000-4000-8000-000000000001',
    email: 'operator@example.com',
    grants: [],
  };

  it('returns only tenant-scoped active configuration options', async () => {
    const findClients = jest.fn().mockReturnValue('clients');
    const findUsers = jest.fn().mockReturnValue('users');
    const findContracts = jest.fn().mockReturnValue('contracts');
    const prisma = {
      ruleDefinition: { findMany: jest.fn().mockReturnValue('definitions') },
      client: { findMany: findClients },
      warehouse: { findMany: jest.fn().mockReturnValue('warehouses') },
      carrier: { findMany: jest.fn().mockReturnValue('carriers') },
      operationalContract: { findMany: findContracts },
      user: { findMany: findUsers },
      $transaction: jest.fn().mockResolvedValue([[], [], [], [], [], []]),
    } as unknown as PrismaService;

    const result = await new RuleConfigurationsService(prisma).options({
      userId: 'user-id',
      organizationId: 'organization-id',
      email: 'operator@example.com',
      grants: [],
    });

    expect(findClients).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'organization-id', status: 'ACTIVE' } }),
    );
    expect(findUsers).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'organization-id', status: 'ACTIVE' } }),
    );
    expect(result.organization.id).toBe('organization-id');
    expect(findContracts).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'organization-id', status: 'ACTIVE' } }),
    );
    expect(result.unsupportedScopes).toEqual(['ROUTE']);
  });

  it('rejects route scopes until their approved domain model exists', async () => {
    const prisma = {
      ruleDefinition: { findUnique: jest.fn().mockResolvedValue({ code: 'LOADING_DELAY' }) },
    } as unknown as PrismaService;
    const service = new RuleConfigurationsService(prisma);

    await expect(
      service.create(
        {
          userId: 'user-id',
          organizationId: '00000000-0000-4000-8000-000000000001',
          email: 'operator@example.com',
          grants: [],
        },
        {
          ruleCode: 'LOADING_DELAY',
          scopeType: 'ROUTE',
          scopeId: '00000000-0000-4000-8000-000000000002',
          priority: 0,
          isEnabled: true,
          isBlocking: false,
          effectiveFrom: '2026-08-11T00:00:00.000Z',
        },
      ),
    ).rejects.toThrow('Route rule scopes require an approved domain model');
  });

  it('requires a tenant contract scope to cover the rule effective start', async () => {
    let contractWhere: { effectiveFrom?: { lte: Date }; effectiveTo?: { gt: Date } } | undefined;
    const prisma = {
      ruleDefinition: { findUnique: jest.fn().mockResolvedValue({ code: 'LOADING_DELAY' }) },
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
      new RuleConfigurationsService(prisma).create(principal, {
        ruleCode: 'LOADING_DELAY',
        scopeType: 'CONTRACT',
        scopeId: '00000000-0000-4000-8000-000000000002',
        priority: 0,
        isEnabled: true,
        isBlocking: false,
        effectiveFrom: '2026-08-11T00:00:00.000Z',
      }),
    ).rejects.toThrow('Active contract scope not found');
    expect(contractWhere?.effectiveFrom?.lte).toEqual(new Date('2026-08-11T00:00:00.000Z'));
    expect(contractWhere?.effectiveTo?.gt).toEqual(new Date('2026-08-11T00:00:00.000Z'));
  });

  it('rejects calendars that pause the approved continuous SLA clock', async () => {
    const prisma = {} as unknown as PrismaService;

    await expect(
      new RuleConfigurationsService(prisma).create(principal, {
        ruleCode: 'LOADING_DELAY',
        scopeType: 'ORGANIZATION',
        scopeId: principal.organizationId,
        priority: 0,
        isEnabled: true,
        isBlocking: false,
        workingCalendar: { pauseSlaOnOfficialHolidays: true },
        effectiveFrom: '2026-08-11T00:00:00.000Z',
      }),
    ).rejects.toThrow('Only the approved continuous 24/7 working calendar is supported');
  });

  it('locks the scope before selecting the next version', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ version: 3 });
    const create = jest.fn().mockResolvedValue({
      id: 'configuration-id',
      ruleCode: 'LOADING_DELAY',
      scopeType: 'ORGANIZATION',
      scopeId: principal.organizationId,
      priority: 0,
      version: 4,
      isEnabled: true,
      thresholdMinutes: 30,
      quantityTolerance: null,
      severity: null,
      isBlocking: false,
      ownerUserId: null,
      ownerScopeType: null,
      ownerScopeId: null,
      timeZone: null,
      workingCalendar: null,
      effectiveFrom: new Date('2026-09-01T00:00:00Z'),
      effectiveTo: null,
    });
    const tx = {
      $executeRaw: queryRaw,
      ruleConfiguration: { findFirst, create },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const transaction = jest.fn(
      (callback: (client: typeof tx) => Promise<unknown>, options?: { isolationLevel: string }) => {
        void options;
        return callback(tx);
      },
    );
    const prisma = {
      ruleDefinition: { findUnique: jest.fn().mockResolvedValue({ code: 'LOADING_DELAY' }) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await new RuleConfigurationsService(prisma).create(principal, {
      ruleCode: 'LOADING_DELAY',
      scopeType: 'ORGANIZATION',
      scopeId: principal.organizationId,
      priority: 0,
      isEnabled: true,
      thresholdMinutes: 30,
      isBlocking: false,
      effectiveFrom: '2026-09-01T00:00:00Z',
    });

    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findFirst.mock.invocationCallOrder[0],
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: 'ReadCommitted' });
  });
});
