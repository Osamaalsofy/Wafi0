import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { AssignExceptionDto } from './dto/assign-exception.dto';
import type { AttachEvidenceDto } from './dto/attach-evidence.dto';
import type { ChangeExceptionSeverityDto } from './dto/change-exception-severity.dto';
import type { CompleteActionDto } from './dto/complete-action.dto';
import type { CreateActionDto } from './dto/create-action.dto';
import type { CreateDecisionDto } from './dto/create-decision.dto';
import type { CreateRootCauseDto } from './dto/create-root-cause.dto';
import type { ListExceptionsQueryDto } from './dto/list-exceptions-query.dto';
import type { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import type { ResolveExceptionDto } from './dto/resolve-exception.dto';

@Injectable()
export class ExceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListExceptionsQueryDto) {
    const where: Prisma.OperationalExceptionWhereInput = {
      organizationId: principal.organizationId,
      status: query.status,
      severity: query.severity,
      ruleCode: query.ruleCode,
      missionId: query.missionId,
      ownerUserId: query.ownerUserId,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.operationalException.findMany({
        where,
        include: this.summaryRelations,
        orderBy: [{ lastDetectedAt: 'desc' }, { openedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.operationalException.count({ where }),
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

  async get(principal: AuthenticatedPrincipal, id: string) {
    const exception = await this.prisma.operationalException.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: {
        ...this.summaryRelations,
        affectedStops: {
          include: { stop: { include: { branch: true } } },
          orderBy: { stop: { sequence: 'asc' } },
        },
        evidence: {
          include: { document: true },
          orderBy: [{ createdAt: 'asc' }, { documentId: 'asc' }],
        },
        rootCauses: {
          include: { confirmedBy: { select: { id: true, name: true } } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        decisions: {
          include: {
            decidedBy: { select: { id: true, name: true } },
            actions: {
              include: { owner: { select: { id: true, name: true } } },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ decidedAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!exception) throw new NotFoundException('Operational exception not found');
    return exception;
  }

  async assign(principal: AuthenticatedPrincipal, id: string, input: AssignExceptionDto) {
    if (input.ownerUserId) await this.requireUser(principal, input.ownerUserId);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockException(tx, principal, id);
      const ownerUserId = input.ownerUserId ?? null;
      if (current.ownerUserId === ownerUserId) return current;
      const updated = await tx.operationalException.update({
        where: { id },
        data: { ownerUserId },
      });
      await this.audit(tx, principal, 'OperationalException', id, 'exception.owner_changed', {
        oldOwnerUserId: current.ownerUserId,
        newOwnerUserId: updated.ownerUserId,
      });
      return updated;
    });
  }

  async changeSeverity(
    principal: AuthenticatedPrincipal,
    id: string,
    input: ChangeExceptionSeverityDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockException(tx, principal, id);
      const severity = input.severity ?? null;
      if (current.severity === severity) return current;
      const updated = await tx.operationalException.update({
        where: { id },
        data: { severity },
      });
      await this.audit(tx, principal, 'OperationalException', id, 'exception.severity_changed', {
        oldSeverity: current.severity,
        newSeverity: updated.severity,
      });
      return updated;
    });
  }

  async resolve(principal: AuthenticatedPrincipal, id: string, input: ResolveExceptionDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockException(tx, principal, id);
      if (current.status === 'RESOLVED') return current;
      const transition = await tx.operationalException.updateMany({
        where: { id, status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          activeKey: null,
          resolvedAt: new Date(),
          resolutionNotes: input.notes.trim(),
        },
      });
      const updated = await tx.operationalException.findUniqueOrThrow({ where: { id } });
      if (transition.count === 0) return updated;
      await this.audit(tx, principal, 'OperationalException', id, 'exception.resolved', {
        oldStatus: current.status,
        newStatus: updated.status,
        resolutionNotes: updated.resolutionNotes,
      });
      return updated;
    });
  }

  async addRootCause(
    principal: AuthenticatedPrincipal,
    exceptionId: string,
    input: CreateRootCauseDto,
  ) {
    await this.requireException(principal, exceptionId);
    const category = await this.prisma.rootCauseCategory.findFirst({
      where: {
        organizationId: principal.organizationId,
        code: input.category.trim().toUpperCase(),
        isActive: true,
      },
    });
    if (!category) throw new NotFoundException('Active root cause category not found');
    return this.prisma.$transaction(async (tx) => {
      const rootCause = await tx.rootCause.create({
        data: {
          organizationId: principal.organizationId,
          exceptionId,
          category: category.code,
          categoryId: category.id,
          description: input.description.trim(),
          confirmedByUserId: input.confirmed ? principal.userId : undefined,
          confirmedAt: input.confirmed ? new Date() : undefined,
        },
      });
      await this.audit(tx, principal, 'RootCause', rootCause.id, 'root_cause.created', {
        exceptionId,
        category: rootCause.category,
        confirmed: Boolean(rootCause.confirmedAt),
      });
      return rootCause;
    });
  }

  async addDecision(
    principal: AuthenticatedPrincipal,
    exceptionId: string,
    input: CreateDecisionDto,
  ) {
    await this.requireException(principal, exceptionId);
    return this.prisma.$transaction(async (tx) => {
      const decision = await tx.decision.create({
        data: {
          organizationId: principal.organizationId,
          exceptionId,
          decisionText: input.decisionText.trim(),
          decidedByUserId: principal.userId,
        },
      });
      await this.audit(tx, principal, 'Decision', decision.id, 'decision.created', {
        exceptionId,
        decisionText: decision.decisionText,
      });
      return decision;
    });
  }

  async addAction(principal: AuthenticatedPrincipal, decisionId: string, input: CreateActionDto) {
    const decision = await this.prisma.decision.findFirst({
      where: { id: decisionId, organizationId: principal.organizationId },
      select: { id: true, exceptionId: true },
    });
    if (!decision) throw new NotFoundException('Decision not found');
    await this.requireUser(principal, input.ownerUserId);
    return this.prisma.$transaction(async (tx) => {
      const action = await tx.correctiveAction.create({
        data: {
          organizationId: principal.organizationId,
          decisionId,
          ownerUserId: input.ownerUserId,
          actionText: input.actionText.trim(),
          dueAt: input.dueAt,
        },
      });
      await this.audit(tx, principal, 'CorrectiveAction', action.id, 'action.created', {
        decisionId,
        exceptionId: decision.exceptionId,
        ownerUserId: action.ownerUserId,
        dueAt: action.dueAt?.toISOString() ?? null,
      });
      return action;
    });
  }

  async completeAction(
    principal: AuthenticatedPrincipal,
    actionId: string,
    input: CompleteActionDto,
  ) {
    const current = await this.prisma.correctiveAction.findFirst({
      where: { id: actionId, organizationId: principal.organizationId },
      include: { decision: { select: { exceptionId: true } } },
    });
    if (!current) throw new NotFoundException('Corrective action not found');
    if (current.status === 'COMPLETED') return current;
    return this.prisma.$transaction(async (tx) => {
      const transition = await tx.correctiveAction.updateMany({
        where: { id: actionId, status: 'OPEN' },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedByUserId: principal.userId,
          completionNotes: input.notes?.trim(),
        },
      });
      const action = await tx.correctiveAction.findUniqueOrThrow({ where: { id: actionId } });
      if (transition.count === 0) return action;
      await this.audit(tx, principal, 'CorrectiveAction', actionId, 'action.completed', {
        exceptionId: current.decision.exceptionId,
        oldStatus: current.status,
        newStatus: action.status,
        completionNotes: action.completionNotes,
      });
      return action;
    });
  }

  async attachEvidence(
    principal: AuthenticatedPrincipal,
    exceptionId: string,
    input: AttachEvidenceDto,
  ) {
    const exception = await this.requireException(principal, exceptionId);
    const document = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        organizationId: principal.organizationId,
        missionId: exception.missionId,
      },
      select: { id: true },
    });
    if (!document) throw new NotFoundException('Mission document not found');
    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.exceptionEvidence.upsert({
        where: { exceptionId_documentId: { exceptionId, documentId: input.documentId } },
        create: { exceptionId, documentId: input.documentId, purpose: input.purpose?.trim() },
        update: { purpose: input.purpose?.trim() },
      });
      await this.audit(
        tx,
        principal,
        'OperationalException',
        exceptionId,
        'exception.evidence_attached',
        {
          documentId: input.documentId,
          purpose: evidence.purpose,
        },
      );
      return evidence;
    });
  }

  async listAlerts(principal: AuthenticatedPrincipal, query: ListAlertsQueryDto) {
    const where: Prisma.AlertWhereInput = {
      organizationId: principal.organizationId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.alert.findMany({
        where,
        include: {
          exception: { include: this.summaryRelations },
          deliveryAttempts: { orderBy: { attemptNo: 'asc' } },
          escalations: {
            include: { recipient: { select: { id: true, name: true, email: true } } },
            orderBy: [{ escalatedAt: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.alert.count({ where }),
      this.prisma.alert.count({
        where: { organizationId: principal.organizationId, readAt: null },
      }),
    ]);
    return {
      data,
      summary: { unread },
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async markAlertRead(principal: AuthenticatedPrincipal, id: string) {
    const current = await this.prisma.alert.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!current) throw new NotFoundException('Alert not found');
    if (current.readAt) return current;
    return this.prisma.$transaction(async (tx) => {
      const transition = await tx.alert.updateMany({
        where: { id, readAt: null },
        data: { readAt: new Date() },
      });
      const alert = await tx.alert.findUniqueOrThrow({ where: { id } });
      if (transition.count === 0) return alert;
      await this.audit(tx, principal, 'Alert', id, 'alert.read', {
        exceptionId: alert.exceptionId,
        deliveryStatus: alert.status,
        readAt: alert.readAt?.toISOString() ?? null,
      });
      return alert;
    });
  }

  private async requireException(principal: AuthenticatedPrincipal, id: string) {
    const exception = await this.prisma.operationalException.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!exception) throw new NotFoundException('Operational exception not found');
    return exception;
  }

  private async requireUser(principal: AuthenticatedPrincipal, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: principal.organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Active owner user not found');
  }

  private async lockException(
    tx: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    id: string,
  ) {
    const lockKey = `OPERATIONAL_EXCEPTION:${principal.organizationId}:${id}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const exception = await tx.operationalException.findFirst({
      where: { id, organizationId: principal.organizationId },
    });
    if (!exception) throw new NotFoundException('Operational exception not found');
    return exception;
  }

  private audit(
    tx: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    entityType: string,
    entityId: string,
    action: string,
    newValues: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        entityType,
        entityId,
        action,
        newValues,
      },
    });
  }

  private readonly summaryRelations = {
    mission: { select: { id: true, missionNo: true, status: true } },
    stop: { select: { id: true, sequence: true, status: true } },
    owner: { select: { id: true, name: true } },
    definition: { select: { code: true, name: true } },
  } as const;
}
