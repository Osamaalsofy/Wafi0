import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { MISSION_EVENT_TYPES } from '../missions/mission.constants';
import type { CompleteMissionStopDto } from './dto/complete-mission-stop.dto';
import type { RecordStopArrivalDto } from './dto/record-stop-arrival.dto';
import type { StartUnloadingDto } from './dto/start-unloading.dto';
import { RuleEvaluatorService } from '../operational-intelligence/rule-evaluator.service';
import { RULE_CODES } from '../operational-intelligence/rule-codes';

@Injectable()
export class MissionStopOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEvaluator: RuleEvaluatorService = new RuleEvaluatorService(),
  ) {}

  async arrive(principal: AuthenticatedPrincipal, id: string, input: RecordStopArrivalDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.missionStop.findFirst({
        where: { id, organizationId: principal.organizationId },
      });
      if (!current) throw new NotFoundException('Mission stop not found');
      if (current.status === 'ARRIVED') return current;
      if (current.status !== 'PENDING') {
        throw new ConflictException(`Cannot record arrival for a ${current.status} stop`);
      }
      if (
        (await tx.missionStop.count({
          where: {
            missionId: current.missionId,
            sequence: { lt: current.sequence },
            status: { not: 'COMPLETED' },
          },
        })) > 0
      ) {
        throw new ConflictException('Earlier mission stops must be completed first');
      }

      const occurredAt = this.occurredAt(input.occurredAt);
      const updated = await tx.missionStop.updateMany({
        where: { id, organizationId: principal.organizationId, status: 'PENDING' },
        data: { status: 'ARRIVED', actualArrival: occurredAt },
      });
      if (updated.count !== 1) return this.currentTargetOrThrow(tx, id, 'ARRIVED');
      const stop = await tx.missionStop.findUniqueOrThrow({ where: { id } });
      const event = await this.recordOperation(
        tx,
        principal,
        stop,
        MISSION_EVENT_TYPES.stopArrived,
        'mission_stop.arrived',
        { occurredAt: occurredAt.toISOString() },
      );
      const mission = await tx.mission.findUniqueOrThrow({ where: { id: stop.missionId } });
      await this.ruleEvaluator.evaluateTimeRule(tx, {
        mission,
        stop,
        eventId: event.id,
        actorUserId: principal.userId,
        occurredAt,
        affectedStopIds: [stop.id],
        ruleCode: RULE_CODES.stopArrivalDelay,
        scheduledAt: stop.expectedArrival,
        actualAt: stop.actualArrival,
      });
      return stop;
    });
  }

  async startUnloading(principal: AuthenticatedPrincipal, id: string, input: StartUnloadingDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.missionStop.findFirst({
        where: { id, organizationId: principal.organizationId },
      });
      if (!current) throw new NotFoundException('Mission stop not found');
      if (current.status === 'UNLOADING') return current;
      if (current.status !== 'ARRIVED') {
        throw new ConflictException(`Cannot start unloading for a ${current.status} stop`);
      }

      const occurredAt = this.occurredAt(input.occurredAt);
      if (current.actualArrival && occurredAt < current.actualArrival) {
        throw new ConflictException('Unloading cannot start before stop arrival');
      }
      const updated = await tx.missionStop.updateMany({
        where: { id, organizationId: principal.organizationId, status: 'ARRIVED' },
        data: { status: 'UNLOADING', unloadingStartedAt: occurredAt },
      });
      if (updated.count !== 1) return this.currentTargetOrThrow(tx, id, 'UNLOADING');
      const stop = await tx.missionStop.findUniqueOrThrow({ where: { id } });
      await this.recordOperation(
        tx,
        principal,
        stop,
        MISSION_EVENT_TYPES.stopUnloadingStarted,
        'mission_stop.unloading_started',
        { occurredAt: occurredAt.toISOString() },
      );
      return stop;
    });
  }

  async complete(principal: AuthenticatedPrincipal, id: string, input: CompleteMissionStopDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.missionStop.findFirst({
        where: { id, organizationId: principal.organizationId },
      });
      if (!current) throw new NotFoundException('Mission stop not found');
      if (current.status === 'COMPLETED') return current;
      if (current.status !== 'UNLOADING') {
        throw new ConflictException(`Cannot complete a ${current.status} stop`);
      }

      const occurredAt = this.occurredAt(input.occurredAt);
      if (current.unloadingStartedAt && occurredAt < current.unloadingStartedAt) {
        throw new ConflictException('Stop completion cannot precede unloading start');
      }
      const actualQty = input.actualQuantity ?? input.receivedQty;
      if (
        (actualQty !== undefined ||
          input.rejectedQty !== undefined ||
          input.shortageQty !== undefined) &&
        !input.unit
      ) {
        throw new ConflictException(
          'Quantity unit is required when completion quantities are recorded',
        );
      }
      const updated = await tx.missionStop.updateMany({
        where: { id, organizationId: principal.organizationId, status: 'UNLOADING' },
        data: {
          status: 'COMPLETED',
          unloadingCompletedAt: occurredAt,
          receivedQty: input.receivedQty,
          actualQty,
          rejectedQty: input.rejectedQty,
          shortageQty: input.shortageQty,
          quantityUnit: input.unit,
          notes: input.notes?.trim(),
        },
      });
      if (updated.count !== 1) return this.currentTargetOrThrow(tx, id, 'COMPLETED');
      const stop = await tx.missionStop.findUniqueOrThrow({ where: { id } });
      const event = await this.recordOperation(
        tx,
        principal,
        stop,
        MISSION_EVENT_TYPES.stopCompleted,
        'mission_stop.completed',
        {
          occurredAt: occurredAt.toISOString(),
          receivedQty: stop.receivedQty?.toString() ?? null,
          actualQty: stop.actualQty?.toString() ?? null,
          rejectedQty: stop.rejectedQty?.toString() ?? null,
          shortageQty: stop.shortageQty?.toString() ?? null,
          unit: stop.quantityUnit,
        },
      );
      const mission = await tx.mission.findUniqueOrThrow({ where: { id: stop.missionId } });
      const context = {
        mission,
        stop,
        eventId: event.id,
        actorUserId: principal.userId,
        occurredAt,
        affectedStopIds: [stop.id],
      };
      await this.ruleEvaluator.evaluateQuantityRule(tx, {
        ...context,
        ruleCode: RULE_CODES.shortage,
        quantity: stop.shortageQty,
      });
      await this.ruleEvaluator.evaluateQuantityRule(tx, {
        ...context,
        ruleCode: RULE_CODES.rejection,
        quantity: stop.rejectedQty,
      });
      return stop;
    });
  }

  private async recordOperation(
    tx: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    stop: { id: string; missionId: string; status: string },
    eventType: string,
    auditAction: string,
    payload: Record<string, string | null>,
  ) {
    const event = await tx.missionEvent.create({
      data: {
        organizationId: principal.organizationId,
        missionId: stop.missionId,
        stopId: stop.id,
        actorUserId: principal.userId,
        eventType,
        payload,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        entityType: 'MissionStop',
        entityId: stop.id,
        action: auditAction,
        newValues: { status: stop.status, ...payload },
      },
    });
    return event;
  }

  private occurredAt(value?: string) {
    return value ? new Date(value) : new Date();
  }

  private concurrentChange() {
    return new ConflictException('Mission stop changed concurrently; reload and retry');
  }

  private async currentTargetOrThrow(
    tx: Prisma.TransactionClient,
    id: string,
    targetStatus: 'ARRIVED' | 'UNLOADING' | 'COMPLETED',
  ) {
    const latest = await tx.missionStop.findUniqueOrThrow({ where: { id } });
    if (latest.status === targetStatus) return latest;
    throw this.concurrentChange();
  }
}
