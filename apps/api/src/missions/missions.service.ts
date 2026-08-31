import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { ClosureRequirementsService } from '../closure-policies/closure-requirements.service';
import type { CreateMissionStopDto } from '../mission-stops/dto/create-mission-stop.dto';
import type { UpdateMissionStopDto } from '../mission-stops/dto/update-mission-stop.dto';
import type { CreateMissionDto } from './dto/create-mission.dto';
import type { AssignMissionDto } from './dto/assign-mission.dto';
import type { ListMissionEventsQueryDto } from './dto/list-mission-events-query.dto';
import type { ListMissionsQueryDto } from './dto/list-missions-query.dto';
import type { UpdateMissionDto } from './dto/update-mission.dto';
import type { TransitionMissionDto } from './dto/transition-mission.dto';
import { MISSION_EVENT_TYPES } from './mission.constants';
import { MISSION_TRANSITIONS } from './mission-transition.policy';
import { RuleEvaluatorService } from '../operational-intelligence/rule-evaluator.service';
import { RULE_CODES } from '../operational-intelligence/rule-codes';

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closureRequirements: ClosureRequirementsService = new ClosureRequirementsService(),
    private readonly ruleEvaluator: RuleEvaluatorService = new RuleEvaluatorService(),
  ) {}

  async list(principal: AuthenticatedPrincipal, query: ListMissionsQueryDto) {
    const search = query.search?.trim();
    const clientIds = this.allowedClientIds(principal, 'mission.read');
    const where: Prisma.MissionWhereInput = {
      organizationId: principal.organizationId,
      clientId: clientIds ? (query.clientId ? (clientIds.includes(query.clientId) ? query.clientId : '__denied__') : { in: clientIds }) : query.clientId,
      warehouseId: query.warehouseId,
      carrierId: query.carrierId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { missionNo: { contains: search, mode: 'insensitive' as const } },
              { cargoType: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.mission.findMany({
        where,
        include: this.summaryRelations,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.mission.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async listForCurrentDriver(principal: AuthenticatedPrincipal, query: ListMissionsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.MissionWhereInput = {
      organizationId: principal.organizationId,
      driver: { userId: principal.userId },
      status: query.status,
      ...(search
        ? { OR: [
            { missionNo: { contains: search, mode: 'insensitive' as const } },
            { cargoType: { contains: search, mode: 'insensitive' as const } },
          ] }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.mission.findMany({
        where,
        include: this.summaryRelations,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: query.sortOrder }],
      }),
      this.prisma.mission.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async get(principal: AuthenticatedPrincipal, id: string) {
    const clientIds = this.allowedClientIds(principal, 'mission.read');
    const mission = await this.prisma.mission.findFirst({
      where: { id, organizationId: principal.organizationId, clientId: clientIds ? { in: clientIds } : undefined },
      include: {
        ...this.summaryRelations,
        stops: {
          orderBy: { sequence: 'asc' },
          include: { branch: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    return mission;
  }

  async availableTransitions(principal: AuthenticatedPrincipal, id: string) {
    const mission = await this.prisma.mission.findFirst({
      where: { id, organizationId: principal.organizationId },
      select: { status: true },
    });
    if (!mission) throw new NotFoundException('Mission not found');
    return { status: mission.status, transitions: MISSION_TRANSITIONS[mission.status] };
  }

  async create(principal: AuthenticatedPrincipal, input: CreateMissionDto) {
    const missionNo = input.missionNo.trim().toUpperCase();
    await this.requireActiveClientWarehouse(
      principal.organizationId,
      input.clientId,
      input.warehouseId,
    );
    await this.requireActiveContract(
      principal.organizationId,
      input.clientId,
      input.contractId,
      input.scheduledLoadingAt,
    );
    await this.requireActiveRoute(principal.organizationId, input.clientId, input.routeId);
    if (
      await this.prisma.mission.findUnique({
        where: {
          organizationId_missionNo: { organizationId: principal.organizationId, missionNo },
        },
        select: { id: true },
      })
    ) {
      throw new ConflictException('Mission number already exists in this organization');
    }

    return this.prisma.$transaction(async (tx) => {
      const mission = await tx.mission.create({
        data: {
          organizationId: principal.organizationId,
          missionNo,
          clientId: input.clientId,
          contractId: input.contractId,
          routeId: input.routeId,
          warehouseId: input.warehouseId,
          cargoType: input.cargoType?.trim(),
          scheduledLoadingAt: input.scheduledLoadingAt,
          scheduledDepartureAt: input.scheduledDepartureAt,
          notes: input.notes?.trim(),
        },
      });
      await tx.missionEvent.create({
        data: {
          organizationId: principal.organizationId,
          missionId: mission.id,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.created,
          payload: { missionNo: mission.missionNo, status: mission.status },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Mission',
          entityId: mission.id,
          action: 'mission.created',
          newValues: {
            missionNo: mission.missionNo,
            clientId: mission.clientId,
            contractId: mission.contractId,
            routeId: mission.routeId,
            warehouseId: mission.warehouseId,
            status: mission.status,
          },
        },
      });
      return mission;
    });
  }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateMissionDto) {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `MISSION_UPDATE:${principal.organizationId}:${id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const current = await tx.mission.findFirst({
        where: { id, organizationId: principal.organizationId },
      });
      if (!current) throw new NotFoundException('Mission not found');
      const clientId = input.clientId ?? current.clientId;
      const warehouseId = input.warehouseId ?? current.warehouseId;
      const contractId = input.contractId === undefined ? current.contractId : input.contractId;
      const routeId = input.routeId === undefined ? current.routeId : input.routeId;
      await this.requireActiveClientWarehouse(principal.organizationId, clientId, warehouseId, tx);
      await this.requireActiveContract(
        principal.organizationId,
        clientId,
        contractId,
        input.scheduledLoadingAt ?? current.scheduledLoadingAt,
        tx,
      );
      await this.requireActiveRoute(principal.organizationId, clientId, routeId, tx);
      const mission = await tx.mission.update({
        where: { id },
        data: {
          clientId: input.clientId,
          contractId: input.contractId,
          routeId: input.routeId,
          warehouseId: input.warehouseId,
          cargoType: input.cargoType?.trim(),
          scheduledLoadingAt: input.scheduledLoadingAt,
          scheduledDepartureAt: input.scheduledDepartureAt,
          notes: input.notes?.trim(),
        },
      });
      const oldValues = this.editableMissionValues(current);
      const newValues = this.editableMissionValues(mission);
      await tx.missionEvent.create({
        data: {
          organizationId: principal.organizationId,
          missionId: id,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.updated,
          payload: { oldValues, newValues },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Mission',
          entityId: id,
          action: 'mission.updated',
          oldValues,
          newValues,
        },
      });
      return mission;
    });
  }

  async assign(principal: AuthenticatedPrincipal, id: string, input: AssignMissionDto) {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `MISSION_ASSIGNMENT:${principal.organizationId}:${id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const current = await tx.mission.findFirst({
        where: { id, organizationId: principal.organizationId },
      });
      if (!current) throw new NotFoundException('Mission not found');
      if (
        current.carrierId === input.carrierId &&
        current.vehicleId === input.vehicleId &&
        current.driverId === input.driverId
      ) {
        return current;
      }
      const carrier = await tx.carrier.findFirst({
        where: { id: input.carrierId, organizationId: principal.organizationId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!carrier) throw new NotFoundException('Active carrier not found');

      const vehicle = await tx.vehicle.findFirst({
        where: {
          id: input.vehicleId,
          carrierId: input.carrierId,
          organizationId: principal.organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!vehicle) throw new NotFoundException('Active carrier vehicle not found');

      const driver = await tx.driver.findFirst({
        where: {
          id: input.driverId,
          carrierId: input.carrierId,
          organizationId: principal.organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!driver) throw new NotFoundException('Active carrier driver not found');

      const oldValues = {
        carrierId: current.carrierId,
        vehicleId: current.vehicleId,
        driverId: current.driverId,
      };
      const newValues = {
        carrierId: input.carrierId,
        vehicleId: input.vehicleId,
        driverId: input.driverId,
      };
      const mission = await tx.mission.update({ where: { id }, data: newValues });
      if (tx.missionAssignment) {
        await tx.missionAssignment.updateMany({
          where: { missionId: id, organizationId: principal.organizationId, endedAt: null },
          data: { endedAt: new Date() },
        });
        await tx.missionAssignment.create({
          data: {
            organizationId: principal.organizationId,
            missionId: id,
            carrierId: input.carrierId,
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            kind: input.kind ?? (current.driverId || current.vehicleId ? 'REASSIGNMENT' : 'INITIAL'),
            reason: input.reason?.trim(),
            assignedByUserId: principal.userId,
          },
        });
      }
      await tx.missionEvent.create({
        data: {
          organizationId: principal.organizationId,
          missionId: id,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.assignmentChanged,
          payload: { oldValues, newValues },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Mission',
          entityId: id,
          action: 'mission.assignment_changed',
          oldValues,
          newValues,
        },
      });
      return mission;
    });
  }

  async transition(principal: AuthenticatedPrincipal, id: string, input: TransitionMissionDto) {
    const reason = input.reason?.trim();
    return this.prisma.$transaction(async (tx) => {
      if (input.toStatus === 'OPERATIONALLY_CLOSED') {
        const lockKey = `MISSION_OPERATIONAL:${principal.organizationId}:${id}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      }
      const current = await tx.mission.findFirst({
        where: { id, organizationId: principal.organizationId },
        include: { stops: { select: { id: true, status: true } } },
      });
      if (!current) throw new NotFoundException('Mission not found');
      if (current.status === input.toStatus) return current;

      if (!MISSION_TRANSITIONS[current.status].includes(input.toStatus)) {
        throw new ConflictException(
          `Mission cannot transition from ${current.status} to ${input.toStatus}`,
        );
      }
      if (input.toStatus === 'CANCELLED' && !reason) {
        throw new ConflictException('A cancellation reason is required');
      }
      if (
        input.toStatus === 'ASSIGNED' &&
        (!current.carrierId || !current.vehicleId || !current.driverId)
      ) {
        throw new ConflictException('Carrier, vehicle, and driver assignment is required');
      }
      if (
        input.toStatus === 'DELIVERED' &&
        (current.stops.length === 0 || current.stops.some((stop) => stop.status !== 'COMPLETED'))
      ) {
        throw new ConflictException('Every mission stop must be completed before delivery');
      }
      const appliedClosurePolicyId = await this.closureRequirements.assertSatisfied(
        tx,
        current,
        input.toStatus,
      );

      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
      if (
        input.toStatus === 'DEPARTED' &&
        current.actualLoadingAt &&
        occurredAt < current.actualLoadingAt
      ) {
        throw new ConflictException('Mission departure cannot precede loading start');
      }
      const update = await tx.mission.updateMany({
        where: { id, organizationId: principal.organizationId, status: current.status },
        data: {
          status: input.toStatus,
          actualLoadingAt: input.toStatus === 'LOADING' ? occurredAt : undefined,
          actualDepartureAt: input.toStatus === 'DEPARTED' ? occurredAt : undefined,
          operationalClosurePolicyId:
            input.toStatus === 'OPERATIONALLY_CLOSED' ? appliedClosurePolicyId : undefined,
          accountingClosurePolicyId:
            input.toStatus === 'ACCOUNTING_READY' ? appliedClosurePolicyId : undefined,
        },
      });
      if (update.count !== 1) {
        const latest = await tx.mission.findUniqueOrThrow({ where: { id } });
        if (latest.status === input.toStatus) return latest;
        throw new ConflictException('Mission status changed concurrently; reload and retry');
      }
      const mission = await tx.mission.findUniqueOrThrow({ where: { id } });
      if (input.toStatus === 'DELIVERED') {
        await tx.portalNotification?.create({
          data: {
            organizationId: principal.organizationId,
            clientId: current.clientId,
            missionId: id,
            type: 'TRIP_COMPLETED',
            message: `Trip ${current.missionNo} has been completed`,
          },
        });
      }
      const closedExceptionIds =
        input.toStatus === 'OPERATIONALLY_CLOSED'
          ? await this.closeActiveExceptions(tx, principal, id, occurredAt)
          : [];
      const oldValues = { status: current.status };
      const newValues = { status: mission.status };
      const event = await tx.missionEvent.create({
        data: {
          organizationId: principal.organizationId,
          missionId: id,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.statusChanged,
          occurredAt,
          payload: {
            oldStatus: current.status,
            newStatus: mission.status,
            reason: reason ?? null,
            closedExceptionIds,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Mission',
          entityId: id,
          action: 'mission.status_changed',
          oldValues,
          newValues: {
            ...newValues,
            reason: reason ?? null,
            occurredAt: occurredAt.toISOString(),
            closedExceptionIds,
          },
        },
      });
      const evaluationContext = {
        mission,
        eventId: event.id,
        actorUserId: principal.userId,
        occurredAt,
        affectedStopIds: current.stops.map((stop) => stop.id),
      };
      if (input.toStatus === 'LOADING') {
        await this.ruleEvaluator.evaluateTimeRule(tx, {
          ...evaluationContext,
          ruleCode: RULE_CODES.loadingDelay,
          scheduledAt: mission.scheduledLoadingAt,
          actualAt: mission.actualLoadingAt,
        });
      }
      if (input.toStatus === 'DEPARTED') {
        await this.ruleEvaluator.evaluateTimeRule(tx, {
          ...evaluationContext,
          ruleCode: RULE_CODES.departureDelay,
          scheduledAt: mission.scheduledDepartureAt,
          actualAt: mission.actualDepartureAt,
        });
      }
      return mission;
    });
  }

  private allowedClientIds(principal: AuthenticatedPrincipal, permission: string) {
    const grants = principal.grants.filter((grant) => grant.permission === permission);
    if (grants.some((grant) => grant.scopeType === 'ORGANIZATION')) return undefined;
    const ids = grants.filter((grant) => grant.scopeType === 'CLIENT').map((grant) => grant.scopeId);
    return ids.length ? ids : undefined;
  }

  async addStop(principal: AuthenticatedPrincipal, missionId: string, input: CreateMissionStopDto) {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `MISSION_STOPS:${principal.organizationId}:${missionId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const mission = await tx.mission.findFirst({
        where: { id: missionId, organizationId: principal.organizationId },
        select: { id: true, clientId: true },
      });
      if (!mission) throw new NotFoundException('Mission not found');
      await this.requireActiveBranch(
        principal.organizationId,
        mission.clientId,
        input.branchId,
        tx,
      );
      await this.requireAvailableSequence(missionId, input.sequence, undefined, tx);

      const stop = await tx.missionStop.create({
        data: {
          organizationId: principal.organizationId,
          missionId,
          branchId: input.branchId,
          sequence: input.sequence,
          expectedArrival: input.expectedArrival,
          expectedQty: input.expectedQty,
          quantityUnit: input.quantityUnit,
          notes: input.notes?.trim(),
        },
      });
      await tx.missionEvent.create({
        data: {
          organizationId: principal.organizationId,
          missionId,
          stopId: stop.id,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.stopAdded,
          payload: { branchId: stop.branchId, sequence: stop.sequence },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'MissionStop',
          entityId: stop.id,
          action: 'mission_stop.created',
          newValues: { missionId, branchId: stop.branchId, sequence: stop.sequence },
        },
      });
      return stop;
    });
  }

  async updateStop(principal: AuthenticatedPrincipal, stopId: string, input: UpdateMissionStopDto) {
    const existing = await this.getStop(principal, stopId);

    return this.prisma.$transaction(async (tx) => {
      const lockKey = `MISSION_STOPS:${principal.organizationId}:${existing.missionId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const current = await tx.missionStop.findFirst({
        where: { id: stopId, organizationId: principal.organizationId },
        include: { mission: { select: { id: true, clientId: true } } },
      });
      if (!current) throw new NotFoundException('Mission stop not found');
      if (input.branchId) {
        await this.requireActiveBranch(
          principal.organizationId,
          current.mission.clientId,
          input.branchId,
          tx,
        );
      }
      if (input.sequence !== undefined && input.sequence !== current.sequence) {
        await this.requireAvailableSequence(current.missionId, input.sequence, stopId, tx);
      }

      const stop = await tx.missionStop.update({
        where: { id: stopId },
        data: {
          branchId: input.branchId,
          sequence: input.sequence,
          expectedArrival: input.expectedArrival,
          expectedQty: input.expectedQty,
          quantityUnit: input.quantityUnit,
          notes: input.notes?.trim(),
        },
      });
      const oldValues = this.editableStopValues(current);
      const newValues = this.editableStopValues(stop);
      await tx.missionEvent.create({
        data: {
          organizationId: principal.organizationId,
          missionId: current.missionId,
          stopId,
          actorUserId: principal.userId,
          eventType: MISSION_EVENT_TYPES.stopUpdated,
          payload: { oldValues, newValues },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'MissionStop',
          entityId: stopId,
          action: 'mission_stop.updated',
          oldValues,
          newValues,
        },
      });
      return stop;
    });
  }

  async listEvents(
    principal: AuthenticatedPrincipal,
    missionId: string,
    query: ListMissionEventsQueryDto,
  ) {
    await this.get(principal, missionId);
    const where = { organizationId: principal.organizationId, missionId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.missionEvent.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.missionEvent.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private async getStop(principal: AuthenticatedPrincipal, id: string) {
    const stop = await this.prisma.missionStop.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: { mission: { select: { id: true, clientId: true } } },
    });
    if (!stop) throw new NotFoundException('Mission stop not found');
    return stop;
  }

  private async closeActiveExceptions(
    tx: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    missionId: string,
    occurredAt: Date,
  ) {
    const active = await tx.operationalException.findMany({
      where: { organizationId: principal.organizationId, missionId, status: 'OPEN' },
      select: { id: true, resolutionNotes: true },
      orderBy: { id: 'asc' },
    });
    const closedIds: string[] = [];
    for (const exception of active) {
      const transition = await tx.operationalException.updateMany({
        where: {
          id: exception.id,
          organizationId: principal.organizationId,
          missionId,
          status: 'OPEN',
        },
        data: {
          status: 'RESOLVED',
          activeKey: null,
          resolvedAt: occurredAt,
          resolutionNotes: 'Mission operationally closed',
        },
      });
      if (transition.count === 0) continue;
      closedIds.push(exception.id);
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'OperationalException',
          entityId: exception.id,
          action: 'exception.resolved_on_mission_closure',
          oldValues: { status: 'OPEN', resolutionNotes: exception.resolutionNotes },
          newValues: {
            status: 'RESOLVED',
            missionId,
            resolvedAt: occurredAt.toISOString(),
            resolutionNotes: 'Mission operationally closed',
          },
        },
      });
    }
    return closedIds;
  }

  private async requireActiveClientWarehouse(
    organizationId: string,
    clientId: string,
    warehouseId: string,
    database: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (
      !(await database.warehouse.findFirst({
        where: {
          id: warehouseId,
          organizationId,
          clientId,
          status: 'ACTIVE',
          client: { status: 'ACTIVE' },
        },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Active client warehouse not found');
    }
  }

  private async requireActiveContract(
    organizationId: string,
    clientId: string,
    contractId?: string | null,
    scheduledLoadingAt?: string | Date | null,
    database: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (!contractId) return;
    const effectiveAt = scheduledLoadingAt ? new Date(scheduledLoadingAt) : new Date();
    if (
      !(await database.operationalContract.findFirst({
        where: {
          id: contractId,
          organizationId,
          status: 'ACTIVE',
          effectiveFrom: { lte: effectiveAt },
          effectiveTo: { gt: effectiveAt },
          parties: { some: { partyType: 'CLIENT', partyId: clientId } },
        },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Active contract for mission client not found');
    }
  }

  private async requireActiveBranch(
    organizationId: string,
    clientId: string,
    branchId: string,
    database: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (
      !(await database.branch.findFirst({
        where: { id: branchId, organizationId, clientId, status: 'ACTIVE' },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Active client branch not found');
    }
  }

  private async requireActiveRoute(
    organizationId: string,
    clientId: string,
    routeId?: string | null,
    database: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (!routeId) return;
    if (
      !(await database.operationalRoute.findFirst({
        where: { id: routeId, organizationId, clientId, status: 'ACTIVE' },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Active route for mission client not found');
    }
  }

  private async requireAvailableSequence(
    missionId: string,
    sequence: number,
    exceptId?: string,
    database: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (
      await database.missionStop.findFirst({
        where: { missionId, sequence, id: exceptId ? { not: exceptId } : undefined },
        select: { id: true },
      })
    ) {
      throw new ConflictException('Mission stop sequence already exists');
    }
  }

  private editableMissionValues(mission: {
    clientId: string;
    contractId: string | null;
    routeId: string | null;
    warehouseId: string;
    cargoType: string | null;
    scheduledLoadingAt: Date | null;
    scheduledDepartureAt: Date | null;
    notes: string | null;
  }) {
    return {
      clientId: mission.clientId,
      contractId: mission.contractId,
      routeId: mission.routeId,
      warehouseId: mission.warehouseId,
      cargoType: mission.cargoType,
      scheduledLoadingAt: mission.scheduledLoadingAt?.toISOString() ?? null,
      scheduledDepartureAt: mission.scheduledDepartureAt?.toISOString() ?? null,
      notes: mission.notes,
    };
  }

  private editableStopValues(stop: {
    branchId: string;
    sequence: number;
    expectedArrival: Date | null;
    expectedQty: { toString(): string } | null;
    notes: string | null;
  }) {
    return {
      branchId: stop.branchId,
      sequence: stop.sequence,
      expectedArrival: stop.expectedArrival?.toISOString() ?? null,
      expectedQty: stop.expectedQty?.toString() ?? null,
      notes: stop.notes,
    };
  }

  private readonly summaryRelations = {
    client: { select: { id: true, code: true, name: true } },
    contract: { select: { id: true, code: true, name: true, cadence: true, status: true } },
    route: {
      select: { id: true, code: true, name: true, cityRegion: true, timeZone: true, status: true },
    },
    warehouse: { select: { id: true, code: true, name: true } },
    carrier: { select: { id: true, code: true, name: true } },
    vehicle: { select: { id: true, plateNo: true } },
    driver: { select: { id: true, name: true } },
  } as const;
}
