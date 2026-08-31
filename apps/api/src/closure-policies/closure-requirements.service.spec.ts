jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { Prisma } from '../../generated/prisma/client';
import { ClosureRequirementsService } from './closure-requirements.service';

describe('ClosureRequirementsService', () => {
  const mission = {
    id: 'mission-id',
    organizationId: 'organization-id',
    clientId: 'client-id',
    stops: [{ id: 'stop-1' }, { id: 'stop-2' }],
  };

  it('allows an explicitly active policy with no document requirements', async () => {
    const tx = {
      closurePolicy: { findFirst: jest.fn().mockResolvedValue({ requirements: [] }) },
    } as unknown as Prisma.TransactionClient;

    await expect(
      new ClosureRequirementsService().assertSatisfied(tx, mission, 'OPERATIONALLY_CLOSED'),
    ).resolves.toBeUndefined();
  });

  it('requires a verified matching document at every stop', async () => {
    const tx = {
      closurePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          requirements: [{ documentType: 'POD', scope: 'EACH_STOP' }],
        }),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([{ type: 'POD', stopId: 'stop-1' }]),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      new ClosureRequirementsService().assertSatisfied(tx, mission, 'OPERATIONALLY_CLOSED'),
    ).rejects.toThrow('Missing verified POD document for EACH_STOP');
  });

  it('ignores closure policies for non-gated status transitions', async () => {
    const tx = {} as Prisma.TransactionClient;
    await expect(
      new ClosureRequirementsService().assertSatisfied(tx, mission, 'CLOSED'),
    ).resolves.toBeUndefined();
  });
});
