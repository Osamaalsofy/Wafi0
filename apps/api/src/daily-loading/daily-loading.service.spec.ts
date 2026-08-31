jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import type { PrismaService } from '../database/prisma.service';
import { DailyLoadingService } from './daily-loading.service';
import type { RuleEvaluatorService } from '../operational-intelligence/rule-evaluator.service';

const principal = {
  userId: 'ccf53388-915d-49a8-80be-c0fca1d0a59c',
  organizationId: 'ae1ea62d-0626-4762-88c4-16bd3fddcba9',
  email: 'operator@example.com',
  grants: [],
};

describe('DailyLoadingService', () => {
  it('uses the authenticated organization and reports exact persisted counts', async () => {
    let organizationId: string | undefined;
    const findMany = jest.fn((args: { where: { organizationId?: string } }) => {
      organizationId = args.where.organizationId;
      return 'missions-query';
    });
    const prisma = {
      mission: {
        findMany,
        count: jest.fn().mockReturnValue('count-query'),
        groupBy: jest.fn().mockReturnValue('group-query'),
      },
      operationalException: { count: jest.fn().mockReturnValue('exception-count-query') },
      $transaction: jest.fn().mockResolvedValue([
        [
          {
            id: 'mission-id',
            missionNo: 'M-001',
            scheduledLoadingAt: new Date('2026-08-10T08:00:00Z'),
            actualLoadingAt: null,
            stops: [{ status: 'COMPLETED' }, { status: 'PENDING' }],
            exceptions: [
              {
                id: 'exception-id',
                ruleCode: 'LOADING_DELAY',
                delayMinutes: 31,
              },
            ],
          },
        ],
        1,
        [{ status: 'ASSIGNED', _count: { _all: 1 } }],
        1,
        0,
      ]),
    } as unknown as PrismaService;
    const ruleEvaluator = {
      describeRule: jest.fn().mockResolvedValue({
        available: true,
        ruleCode: 'LOADING_DELAY',
        enabled: true,
        thresholdMinutes: 30,
        source: 'DEFINITION_DEFAULT',
        configuration: null,
      }),
    } as unknown as RuleEvaluatorService;

    const result = await new DailyLoadingService(prisma, ruleEvaluator).get(principal, {
      from: '2026-08-10T00:00:00.000Z',
      to: '2026-08-11T00:00:00.000Z',
      page: 1,
      limit: 25,
    });

    expect(organizationId).toBe(principal.organizationId);
    expect(result.summary.byStatus.ASSIGNED).toBe(1);
    expect(result.summary.byStatus.DRAFT).toBe(0);
    expect(result.summary.delayEvaluation.available).toBe(true);
    expect(result.summary.openLoadingDelays).toBe(1);
    expect(result.summary.incompleteDataConditions).toBe(0);
    expect(result.data[0]?.loadingRule).toMatchObject({
      enabled: true,
      thresholdMinutes: 30,
    });
    expect(result.data[0]?.openExceptions).toEqual([
      { id: 'exception-id', ruleCode: 'LOADING_DELAY', delayMinutes: 31 },
    ]);
    expect(result.data[0]?.stopProgress).toEqual({
      total: 2,
      pending: 1,
      arrived: 0,
      unloading: 0,
      completed: 1,
      cancelled: 0,
    });
  });

  it('rejects an inverted time window', async () => {
    const service = new DailyLoadingService({} as PrismaService);

    await expect(
      service.get(principal, {
        from: '2026-08-11T00:00:00.000Z',
        to: '2026-08-10T00:00:00.000Z',
        page: 1,
        limit: 25,
      }),
    ).rejects.toThrow('The daily-loading window end must follow its start');
  });
});
