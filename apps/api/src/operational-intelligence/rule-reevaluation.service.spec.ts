jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import type { RuleEvaluatorService } from './rule-evaluator.service';
import { RuleReevaluationService } from './rule-reevaluation.service';

const principal = {
  userId: 'user-id',
  organizationId: 'organization-id',
  email: 'operator@example.com',
  grants: [],
};

describe('RuleReevaluationService', () => {
  it('requires an explicit bounded mission or schedule window', async () => {
    const service = new RuleReevaluationService({} as PrismaService, {} as RuleEvaluatorService);
    await expect(
      service.reevaluate(principal, {
        evaluationAt: '2026-08-11T10:00:00Z',
        maxMissions: 100,
      }),
    ).rejects.toThrow('missionId or a complete scheduledFrom/scheduledTo window is required');
  });

  it('skips future operations and uses a stable source occurrence for due missing data', async () => {
    const evaluateTimeRule = jest.fn().mockResolvedValue(undefined);
    const evaluator = { evaluateTimeRule } as unknown as RuleEvaluatorService;
    const transactionClient = {
      missionEvent: { create: jest.fn().mockResolvedValue({ id: 'evaluation-event-id' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      mission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mission-id',
            organizationId: 'organization-id',
            clientId: 'client-id',
            warehouseId: 'warehouse-id',
            carrierId: null,
            vehicleId: null,
            driverId: null,
            scheduledLoadingAt: new Date('2026-08-11T09:00:00Z'),
            actualLoadingAt: null,
            scheduledDepartureAt: new Date('2026-08-11T12:00:00Z'),
            actualDepartureAt: null,
            stops: [],
          },
        ]),
      },
      $transaction: jest.fn((callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    } as unknown as PrismaService;

    const result = await new RuleReevaluationService(prisma, evaluator).reevaluate(principal, {
      evaluationAt: '2026-08-11T10:00:00Z',
      missionId: '11111111-1111-4111-8111-111111111111',
      maxMissions: 100,
    });

    expect(result).toMatchObject({
      missions: 1,
      timeRulesEvaluated: 1,
      futureOperationsSkipped: 1,
    });
    expect(evaluateTimeRule).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        ruleCode: 'LOADING_DELAY',
        actualAt: null,
        occurrenceId: 'LOADING_DELAY:MISSION:2026-08-11T09:00:00.000Z',
      }),
    );
  });

  it('returns a stable cursor so bounded reevaluation can reach later missions', async () => {
    let query:
      | {
          orderBy: Array<Record<string, string>>;
          take: number;
          where: Record<string, unknown>;
        }
      | undefined;
    const first = {
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: principal.organizationId,
      clientId: 'client-id',
      warehouseId: 'warehouse-id',
      carrierId: null,
      vehicleId: null,
      driverId: null,
      updatedAt: new Date('2026-08-11T09:00:00Z'),
      scheduledLoadingAt: null,
      actualLoadingAt: null,
      scheduledDepartureAt: null,
      actualDepartureAt: null,
      stops: [],
    };
    const second = {
      ...first,
      id: '00000000-0000-4000-8000-000000000002',
      updatedAt: new Date('2026-08-11T09:01:00Z'),
    };
    const prisma = {
      mission: {
        findMany: jest.fn((input: typeof query) => {
          query = input;
          return Promise.resolve([first, second]);
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const result = await new RuleReevaluationService(prisma, {} as RuleEvaluatorService).reevaluate(
      principal,
      {
        evaluationAt: '2026-08-11T10:00:00Z',
        scheduledFrom: '2026-08-11T00:00:00Z',
        scheduledTo: '2026-08-12T00:00:00Z',
        maxMissions: 1,
      },
    );

    expect(query?.orderBy).toEqual([{ updatedAt: 'asc' }, { id: 'asc' }]);
    expect(query?.take).toBe(2);
    expect(result).toMatchObject({
      missions: 1,
      nextCursor: {
        afterUpdatedAt: '2026-08-11T09:00:00.000Z',
        afterMissionId: first.id,
      },
    });
  });
});
