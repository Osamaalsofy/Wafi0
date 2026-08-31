import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CalculateKpiDto } from './dto/calculate-kpi.dto';
import { calculateMissionKpi, hashKpiInputs, type KpiMissionInput } from './kpi-engine';

@Injectable()
export class KpiResultsService {
  constructor(private readonly prisma: PrismaService) {}

  list(principal: AuthenticatedPrincipal) {
    return this.prisma.kpiResult.findMany({
      where: { organizationId: principal.organizationId },
      include: { snapshot: { include: { configuration: { include: { definition: true } } } } },
      orderBy: [{ periodStart: 'desc' }, { calculationVersion: 'desc' }],
    });
  }

  async get(principal: AuthenticatedPrincipal, id: string) {
    const result = await this.prisma.kpiResult.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: { missions: { orderBy: { missionId: 'asc' } }, snapshot: true },
    });
    if (!result) throw new NotFoundException('KPI result not found');
    return result;
  }

  async calculate(principal: AuthenticatedPrincipal, input: CalculateKpiDto) {
    const calculatedAt = new Date(input.calculatedAt);
    const snapshot = await this.prisma.kpiFactSnapshot.findFirst({
      where: { id: input.snapshotId, organizationId: principal.organizationId },
      include: { configuration: true, missionFacts: { orderBy: { missionId: 'asc' } } },
    });
    if (!snapshot) throw new NotFoundException('KPI fact snapshot not found');
    if (calculatedAt < snapshot.sourceCutoffAt)
      throw new ConflictException('calculatedAt cannot precede the source cutoff');

    const scores = snapshot.missionFacts.map((fact) => {
      const state = fact.missionState as unknown as Omit<
        KpiMissionInput,
        | 'missionId'
        | 'clientId'
        | 'carrierId'
        | 'driverId'
        | 'exceptions'
        | 'externalDataAvailability'
      >;
      const external = fact.externalDataAvailability as KpiMissionInput['externalDataAvailability'];
      return calculateMissionKpi(
        {
          ...state,
          missionId: fact.missionId,
          clientId: fact.clientId,
          carrierId: fact.carrierId,
          driverId: fact.driverId,
          exceptions: fact.exceptionFacts as unknown as KpiMissionInput['exceptions'],
          externalDataAvailability: external,
        },
        Number(snapshot.configuration.targetPercent),
      );
    });
    const eligible = scores.filter((score) => score.score !== null);
    const aggregateScore = eligible.length
      ? Math.round(
          (eligible.reduce((sum, item) => sum + (item.score ?? 0), 0) / eligible.length) * 100,
        ) / 100
      : null;
    const inputHash = hashKpiInputs({
      snapshotId: snapshot.id,
      sourceCutoffAt: snapshot.sourceCutoffAt.toISOString(),
      scores,
    });
    const periodStart = snapshot.periodDate;
    const periodEnd = this.periodEnd(periodStart, input.periodType);

    return this.prisma.$transaction(
      async (tx) => {
        const lockKey = `KPI_RESULT:${principal.organizationId}:${snapshot.id}:${input.periodType}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const latest = await tx.kpiResult.findFirst({
          where: {
            organizationId: principal.organizationId,
            snapshotId: snapshot.id,
            periodType: input.periodType,
          },
          orderBy: { calculationVersion: 'desc' },
        });
        if (latest?.status === 'PUBLISHED')
          throw new ConflictException(
            'Published KPI results are immutable; create a new source snapshot',
          );
        if (latest?.inputHash === inputHash) return this.get(principal, latest.id);
        const result = await tx.kpiResult.create({
          data: {
            organizationId: principal.organizationId,
            snapshotId: snapshot.id,
            periodType: input.periodType,
            periodStart,
            periodEnd,
            timeZone: snapshot.timeZone,
            calculationVersion: (latest?.calculationVersion ?? 0) + 1,
            score: aggregateScore,
            targetPercent: snapshot.configuration.targetPercent,
            eligibleMissionCount: eligible.length,
            componentSummary: this.componentSummary(scores),
            inputHash,
            calculatedAt,
            sourceCutoffAt: snapshot.sourceCutoffAt,
            createdByUserId: principal.userId,
            missions: {
              create: scores.map((score, index) => ({
                organizationId: principal.organizationId,
                missionId: score.missionId,
                clientId: snapshot.missionFacts[index].clientId,
                carrierId: snapshot.missionFacts[index].carrierId,
                driverId: snapshot.missionFacts[index].driverId,
                score: score.score,
                applicableWeight: score.applicableWeight,
                targetMet: score.targetMet,
                components: score.components as unknown as Prisma.InputJsonValue,
              })),
            },
          },
          include: { missions: true },
        });
        await tx.auditLog.create({
          data: {
            organizationId: principal.organizationId,
            actorUserId: principal.userId,
            entityType: 'KpiResult',
            entityId: result.id,
            action: 'kpi_result.calculated',
            newValues: {
              snapshotId: snapshot.id,
              inputHash,
              calculatedAt: calculatedAt.toISOString(),
              score: aggregateScore,
            },
          },
        });
        return result;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async publish(principal: AuthenticatedPrincipal, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.kpiResult.findFirst({
        where: { id, organizationId: principal.organizationId },
      });
      if (!result) throw new NotFoundException('KPI result not found');
      if (result.status === 'PUBLISHED') return result;
      const publishedAt = new Date();
      const updated = await tx.kpiResult.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt, publishedByUserId: principal.userId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'KpiResult',
          entityId: id,
          action: 'kpi_result.published',
          newValues: { publishedAt: publishedAt.toISOString(), inputHash: result.inputHash },
        },
      });
      return updated;
    });
  }

  private periodEnd(start: Date, type: CalculateKpiDto['periodType']) {
    const end = new Date(start);
    if (type === 'WEEKLY') end.setUTCDate(end.getUTCDate() + 6);
    if (type === 'MONTHLY') end.setUTCMonth(end.getUTCMonth() + 1, 0);
    return end;
  }

  private componentSummary(scores: ReturnType<typeof calculateMissionKpi>[]) {
    return Object.fromEntries(
      Object.keys(
        scores[0]?.components.reduce<Record<string, true>>(
          (all, item) => ({ ...all, [item.code]: true }),
          {},
        ) ?? {},
      ).map((code) => {
        const values = scores.flatMap((score) =>
          score.components
            .filter((item) => item.code === code && item.score !== null)
            .map((item) => item.score as number),
        );
        return [
          code,
          {
            availableMissionCount: values.length,
            score: values.length
              ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
              : null,
          },
        ];
      }),
    );
  }
}
