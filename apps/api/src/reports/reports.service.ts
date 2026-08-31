import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type {
  DocumentType,
  DocumentVerificationStatus,
  ExceptionSeverity,
  ExceptionStatus,
  MalwareScanStatus,
  MissionStatus,
  MissionStopStatus,
  Prisma,
} from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { ReportQueryDto } from './dto/report-query.dto';

export const REPORT_TYPES = [
  'mission-performance',
  'client-sla',
  'driver-performance',
  'carrier-performance',
  'kpi',
  'exceptions',
  'delays',
  'route-deviation',
  'pod-compliance',
  'contract-performance',
  'audit',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
type Row = Record<string, string | number | boolean | null>;
interface ReportMission {
  id: string;
  missionNo: string;
  status: MissionStatus;
  client: { id: string; code: string; name: string };
  carrier: { id: string; code: string; name: string } | null;
  driver: { id: string; name: string } | null;
  route: { id: string; code: string; name: string } | null;
  contract: { id: string; code: string; name: string } | null;
  stops: Array<{
    expectedArrival: Date | null;
    actualArrival: Date | null;
    status: MissionStopStatus;
  }>;
  documents: Array<{
    type: DocumentType;
    verificationStatus: DocumentVerificationStatus;
    malwareScanStatus: MalwareScanStatus;
  }>;
  exceptions: Array<{
    id: string;
    ruleCode: string;
    status: ExceptionStatus;
    severity: ExceptionSeverity | null;
    delayMinutes: number | null;
    openedAt: Date;
    resolvedAt: Date | null;
  }>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(principal: AuthenticatedPrincipal, type: ReportType, query: ReportQueryDto) {
    if (!REPORT_TYPES.includes(type)) throw new BadRequestException('Unsupported report type');
    this.assertPermission(principal, type);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from) throw new BadRequestException('Report window end must follow its start');
    if (type === 'audit') return this.audit(principal.organizationId, from, to);
    if (type === 'kpi') return this.kpi(principal.organizationId, from, to);

    const where: Prisma.MissionWhereInput = {
      organizationId: principal.organizationId,
      createdAt: { gte: from, lt: to },
      id: query.missionId,
      clientId: query.clientId,
      carrierId: query.carrierId,
      driverId: query.driverId,
    };
    const missions = await this.prisma.mission.findMany({
      where,
      include: {
        client: { select: { id: true, code: true, name: true } },
        carrier: { select: { id: true, code: true, name: true } },
        driver: { select: { id: true, name: true } },
        route: { select: { id: true, code: true, name: true } },
        contract: { select: { id: true, code: true, name: true } },
        stops: { select: { expectedArrival: true, actualArrival: true, status: true } },
        documents: { select: { type: true, verificationStatus: true, malwareScanStatus: true } },
        exceptions: {
          select: {
            id: true,
            ruleCode: true,
            status: true,
            severity: true,
            delayMinutes: true,
            openedAt: true,
            resolvedAt: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { missionNo: 'asc' }],
      take: 5000,
    });

    let rows: Row[];
    if (type === 'mission-performance') rows = missions.map((mission) => this.missionRow(mission));
    else if (type === 'client-sla') rows = this.groupPerformance(missions, 'client');
    else if (type === 'driver-performance') rows = this.groupPerformance(missions, 'driver');
    else if (type === 'carrier-performance') rows = this.groupPerformance(missions, 'carrier');
    else if (type === 'exceptions' || type === 'delays' || type === 'route-deviation')
      rows = missions.flatMap((mission) =>
        mission.exceptions
          .filter(
            (exception) =>
              type === 'exceptions' ||
              (type === 'delays'
                ? exception.delayMinutes !== null
                : exception.ruleCode.includes('ROUTE_DEVIATION')),
          )
          .map((exception) => ({
            id: exception.id,
            missionId: mission.id,
            mission: mission.missionNo,
            rule: exception.ruleCode,
            status: exception.status,
            severity: exception.severity,
            delayMinutes: exception.delayMinutes,
            openedAt: exception.openedAt.toISOString(),
            resolvedAt: exception.resolvedAt?.toISOString() ?? null,
          })),
      );
    else if (type === 'pod-compliance')
      rows = missions.map((mission) => {
        const pod = mission.documents.filter((document) => document.type === 'POD');
        const verified = pod.filter(
          (document) =>
            document.verificationStatus === 'VERIFIED' && document.malwareScanStatus === 'CLEAN',
        ).length;
        return {
          id: mission.id,
          mission: mission.missionNo,
          client: mission.client.name,
          podDocuments: pod.length,
          verifiedPod: verified,
          compliant: verified > 0,
        };
      });
    else rows = this.contractPerformance(missions);
    return this.response(type, from, to, rows);
  }

  private assertPermission(principal: AuthenticatedPrincipal, type: ReportType) {
    const specialized: Partial<Record<ReportType, string>> = {
      kpi: 'kpi.read',
      audit: 'audit.read',
      'pod-compliance': 'document.read',
      'contract-performance': 'contract.read',
    };
    const permission = specialized[type];
    if (
      permission &&
      !principal.grants.some(
        (grant) =>
          grant.permission === permission &&
          grant.scopeType === 'ORGANIZATION' &&
          grant.scopeId === principal.organizationId,
      )
    )
      throw new ForbiddenException('Insufficient permission for this report');
  }

  private missionRow(mission: ReportMission): Row {
    const completed = mission.stops.filter((stop) => stop.status === 'COMPLETED').length;
    const late = mission.stops.filter(
      (stop) =>
        stop.expectedArrival && stop.actualArrival && stop.actualArrival > stop.expectedArrival,
    ).length;
    return {
      id: mission.id,
      mission: mission.missionNo,
      client: mission.client.name,
      carrier: mission.carrier?.name ?? null,
      driver: mission.driver?.name ?? null,
      status: mission.status,
      completedStops: completed,
      totalStops: mission.stops.length,
      lateStops: late,
      openExceptions: mission.exceptions.filter((exception) => exception.status === 'OPEN').length,
    };
  }

  private groupPerformance(
    missions: ReportMission[],
    key: 'client' | 'carrier' | 'driver' | 'contract',
  ): Row[] {
    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        total: number;
        completed: number;
        late: number;
        exceptions: number;
      }
    >();
    for (const mission of missions) {
      const entity = mission[key];
      if (!entity) continue;
      const current = groups.get(entity.id) ?? {
        id: entity.id,
        name: entity.name,
        total: 0,
        completed: 0,
        late: 0,
        exceptions: 0,
      };
      current.total += 1;
      current.completed += mission.status === 'CLOSED' ? 1 : 0;
      current.late += mission.stops.some(
        (stop) =>
          stop.expectedArrival && stop.actualArrival && stop.actualArrival > stop.expectedArrival,
      )
        ? 1
        : 0;
      current.exceptions += mission.exceptions.length;
      groups.set(entity.id, current);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      completionPercent: group.total
        ? Math.round((group.completed * 10000) / group.total) / 100
        : 0,
      onTimePercent: group.total
        ? Math.round(((group.total - group.late) * 10000) / group.total) / 100
        : 0,
    }));
  }

  private contractPerformance(missions: ReportMission[]): Row[] {
    const scoped = missions.filter((mission) => mission.contract);
    return this.groupPerformance(scoped, 'contract').map(({ id, name, ...row }) => ({
      id,
      contract: name,
      ...row,
    }));
  }

  private async kpi(organizationId: string, from: Date, to: Date) {
    const results = await this.prisma.kpiResult.findMany({
      where: { organizationId, periodStart: { gte: from, lt: to } },
      include: { snapshot: { include: { configuration: { include: { definition: true } } } } },
      orderBy: { periodStart: 'desc' },
      take: 5000,
    });
    return this.response(
      'kpi',
      from,
      to,
      results.map((result) => ({
        id: result.id,
        kpi: result.snapshot.configuration.definition.name,
        periodStart: result.periodStart.toISOString(),
        periodEnd: result.periodEnd.toISOString(),
        status: result.status,
        score: result.score?.toNumber() ?? null,
        targetPercent: result.targetPercent.toNumber(),
        eligibleMissions: result.eligibleMissionCount,
      })),
    );
  }

  private async audit(organizationId: string, from: Date, to: Date) {
    const logs = await this.prisma.auditLog.findMany({
      where: { organizationId, createdAt: { gte: from, lt: to } },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return this.response(
      'audit',
      from,
      to,
      logs.map((log) => ({
        id: log.id,
        occurredAt: log.createdAt.toISOString(),
        actor: log.actor?.email ?? 'SYSTEM',
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
      })),
    );
  }

  private response(type: ReportType, from: Date, to: Date, rows: Row[]) {
    return {
      type,
      window: { from: from.toISOString(), to: to.toISOString() },
      summary: { rows: rows.length },
      rows,
    };
  }
}
