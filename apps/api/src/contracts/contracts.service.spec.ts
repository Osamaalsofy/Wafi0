jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { ContractsService } from './contracts.service';

const principal = {
  userId: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000002',
  email: 'operator@example.com',
  grants: [],
};

describe('ContractsService', () => {
  it('always scopes contract lists to the authenticated organization', async () => {
    let organizationId: string | undefined;
    let contractOrder: Array<Record<string, string>> | undefined;
    let partyOrder: Array<Record<string, string>> | undefined;
    const prisma = {
      operationalContract: {
        findMany: jest.fn(
          (args: {
            where: { organizationId?: string };
            orderBy: Array<Record<string, string>>;
            include: { parties: { orderBy: Array<Record<string, string>> } };
          }) => {
            organizationId = args.where.organizationId;
            contractOrder = args.orderBy;
            partyOrder = args.include.parties.orderBy;
            return 'contracts';
          },
        ),
        count: jest.fn().mockReturnValue('count'),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as PrismaService;

    await new ContractsService(prisma).list(principal, { page: 1, limit: 25 });

    expect(organizationId).toBe(principal.organizationId);
    expect(contractOrder).toEqual([
      { effectiveFrom: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(partyOrder).toEqual([{ partyType: 'asc' }, { partyId: 'asc' }]);
  });

  it('rejects a client party outside the authenticated organization', async () => {
    const transaction = jest.fn();
    const prisma = {
      operationalContract: { findUnique: jest.fn().mockResolvedValue(null) },
      client: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaService;

    await expect(
      new ContractsService(prisma).create(principal, {
        code: 'CLIENT_DAILY',
        name: 'Client daily contract',
        cadence: 'DAILY',
        effectiveFrom: '2026-08-12T00:00:00Z',
        effectiveTo: '2026-09-12T00:00:00Z',
        parties: [{ partyType: 'CLIENT', partyId: '00000000-0000-4000-8000-000000000003' }],
      }),
    ).rejects.toThrow('Active client party not found');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('expires only due contracts in the authenticated organization and audits the change', async () => {
    let whereOrganizationId: string | undefined;
    let auditAction: string | undefined;
    const tx = {
      operationalContract: {
        findMany: jest.fn((args: { where: { organizationId: string } }) => {
          whereOrganizationId = args.where.organizationId;
          return Promise.resolve([{ id: 'contract-id', status: 'ACTIVE' }]);
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn((args: { data: { action: string } }) => {
          auditAction = args.data.action;
          return Promise.resolve({ id: 'audit-id' });
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;

    const result = await new ContractsService(prisma).expireDue(principal, {
      evaluationAt: '2026-10-01T00:00:00Z',
      limit: 100,
    });

    expect(whereOrganizationId).toBe(principal.organizationId);
    expect(result.expiredIds).toEqual(['contract-id']);
    expect(auditAction).toBe('contract.expired');
  });
});
