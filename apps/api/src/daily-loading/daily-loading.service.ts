import { ConflictException, Injectable } from '@nestjs/common';
import type { MissionStatus, Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { RuleEvaluatorService } from '../operational-intelligence/rule-evaluator.service';
import { RULE_CODES } from '../operational-intelligence/rule-codes';
import type { DailyLoadingQueryDto } from './dto/daily-loading-query.dto';

@Injectable()
export class DailyLoadingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEvaluator: RuleEvaluatorService = new RuleEvaluatorService(),
  ) {}

  async get(principal: AuthenticatedPrincipal, query: DailyLoadingQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from)
      throw new ConflictException('The daily-loading window end must follow its start');

    const where: Prisma.MissionWhereInput = {
      organizationId: principal.organizationId,
      scheduledLoadingAt: { gte: from, lt: to },
      clientId: query.clientId,
      warehouseId: query.warehouseId,
      carrierId: query.carrierId,
    };
    const [missions, total, grouped, openLoadingDelays, incompleteDataConditions] =
      await this.prisma.$transaction([
        this.prisma.mission.findMany({
          where,
          include: {
            client: { select: { id: true, code: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            carrier: { select: { id: true, code: true, name: true } },
            vehicle: { select: { id: true, plateNo: true } },
            driver: { select: { id: true, name: true } },
            stops: { select: { status: true } },
            exceptions: {
              where: {
                status: 'OPEN',
                ruleCode: { in: [RULE_CODES.loadingDelay, RULE_CODES.missingOperationalData] },
              },
              select: {
                id: true,
                ruleCode: true,
                severity: true,
                delayMinutes: true,
                scheduledAt: true,
                actualAt: true,
                context: true,
                lastDetectedAt: true,
              },
              orderBy: { lastDetectedAt: 'desc' },
            },
          },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: [{ scheduledLoadingAt: 'asc' }, { missionNo: 'asc' }],
        }),
        this.prisma.mission.count({ where }),
        this.prisma.mission.groupBy({ by: ['status'], where, _count: { _all: true } }),
        this.prisma.operationalException.count({
          where: {
            organizationId: principal.organizationId,
            status: 'OPEN',
            ruleCode: RULE_CODES.loadingDelay,
            mission: where,
          },
        }),
        this.prisma.operationalException.count({
          where: {
            organizationId: principal.organizationId,
            status: 'OPEN',
            ruleCode: RULE_CODES.missingOperationalData,
            mission: where,
          },
        }),
      ]);

    const ruleStatuses = await Promise.all(
      missions.map((mission) =>
        this.ruleEvaluator.describeRule(
          this.prisma as unknown as Prisma.TransactionClient,
          RULE_CODES.loadingDelay,
          mission,
          mission.actualLoadingAt ?? mission.scheduledLoadingAt ?? from,
        ),
      ),
    );

    const byStatus = this.emptyStatusCounts();
    for (const group of grouped) byStatus[group.status] = group._count._all;

    return {
      window: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        total,
        byStatus,
        delayEvaluation: {
          available: true,
          reason:
            'Per-mission status reports the effective loading rule without recalculating persisted exceptions',
        },
        openLoadingDelays,
        incompleteDataConditions,
      },
      data: missions.map(({ stops, exceptions, ...mission }, index) => ({
        ...mission,
        loadingRule: ruleStatuses[index],
        openExceptions: exceptions,
        stopProgress: {
          total: stops.length,
          pending: stops.filter(({ status }) => status === 'PENDING').length,
          arrived: stops.filter(({ status }) => status === 'ARRIVED').length,
          unloading: stops.filter(({ status }) => status === 'UNLOADING').length,
          completed: stops.filter(({ status }) => status === 'COMPLETED').length,
          cancelled: stops.filter(({ status }) => status === 'CANCELLED').length,
        },
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private emptyStatusCounts(): Record<MissionStatus, number> {
    return {
      DRAFT: 0,
      ASSIGNED: 0,
      WAITING_FOR_VEHICLE: 0,
      VEHICLE_ARRIVED: 0,
      LOADING: 0,
      LOADED: 0,
      DEPARTED: 0,
      IN_TRANSIT: 0,
      AT_STOP: 0,
      DELIVERING: 0,
      DELIVERED: 0,
      OPERATIONALLY_CLOSED: 0,
      ACCOUNTING_READY: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };
  }
}
