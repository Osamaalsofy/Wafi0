import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { EscalateDueAlertsDto } from './dto/escalate-due-alerts.dto';
import type { RecordAlertDeliveryAttemptDto } from './dto/record-alert-delivery-attempt.dto';

const MAX_DELIVERY_ATTEMPTS = 2;
const RETRY_INTERVAL_MS = 5 * 60_000;
const FLEET_MANAGER_ROLE_CODE = 'FLEET_MANAGER';

@Injectable()
export class AlertOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordDeliveryAttempt(
    principal: AuthenticatedPrincipal,
    alertId: string,
    attemptNo: number,
    input: RecordAlertDeliveryAttemptDto,
  ) {
    if (attemptNo < 1 || attemptNo > MAX_DELIVERY_ATTEMPTS) {
      throw new BadRequestException('Alert delivery attempt number must be 1 or 2');
    }
    const attemptedAt = new Date(input.attemptedAt);
    return this.prisma.$transaction(async (tx) => {
      await this.lockAlert(tx, principal.organizationId, alertId);
      const alert = await tx.alert.findFirst({
        where: { id: alertId, organizationId: principal.organizationId },
        include: { deliveryAttempts: { orderBy: { attemptNo: 'asc' } } },
      });
      if (!alert) throw new NotFoundException('Alert not found');
      const existing = alert.deliveryAttempts.find((attempt) => attempt.attemptNo === attemptNo);
      if (existing) return existing;
      if (attemptedAt < alert.createdAt) {
        throw new BadRequestException('Alert delivery attempt cannot precede alert creation');
      }
      if (alert.deliveryAttempts.some((attempt) => attempt.outcome === 'SENT')) {
        throw new BadRequestException('Alert email has already been delivered');
      }
      if (attemptNo !== alert.deliveryAttempts.length + 1) {
        throw new BadRequestException('Alert delivery attempts must be recorded in order');
      }
      const previous = alert.deliveryAttempts.at(-1);
      if (previous?.nextAttemptAt && attemptedAt < previous.nextAttemptAt) {
        throw new BadRequestException('Alert delivery retry is not due yet');
      }

      const nextAttemptAt =
        input.outcome === 'FAILED' && attemptNo < MAX_DELIVERY_ATTEMPTS
          ? new Date(attemptedAt.getTime() + RETRY_INTERVAL_MS)
          : null;
      const attempt = await tx.alertDeliveryAttempt.create({
        data: {
          organizationId: principal.organizationId,
          alertId,
          attemptNo,
          channel: 'EMAIL',
          outcome: input.outcome,
          attemptedAt,
          error: input.error?.trim(),
          nextAttemptAt,
        },
      });
      await tx.alert.update({
        where: { id: alertId },
        data:
          input.outcome === 'SENT'
            ? { status: 'SENT', sentAt: attemptedAt }
            : { status: attemptNo === MAX_DELIVERY_ATTEMPTS ? 'FAILED' : 'PENDING' },
      });
      await this.audit(tx, principal, 'Alert', alertId, 'alert.delivery_attempted', {
        attemptId: attempt.id,
        attemptNo,
        channel: 'EMAIL',
        outcome: attempt.outcome,
        attemptedAt: attempt.attemptedAt.toISOString(),
        nextAttemptAt: attempt.nextAttemptAt?.toISOString() ?? null,
        error: attempt.error,
      });
      return attempt;
    });
  }

  async escalateDue(principal: AuthenticatedPrincipal, input: EscalateDueAlertsDto) {
    const evaluatedAt = new Date(input.evaluatedAt);
    const candidates = await this.prisma.alert.findMany({
      where: {
        organizationId: principal.organizationId,
        escalationDueAt: { lte: evaluatedAt },
        escalatedAt: null,
        exception: { status: 'OPEN' },
      },
      select: { id: true },
      orderBy: [{ escalationDueAt: 'asc' }, { id: 'asc' }],
      take: input.limit,
    });
    const managers = await this.prisma.user.findMany({
      where: {
        organizationId: principal.organizationId,
        status: 'ACTIVE',
        roleAssignments: {
          some: {
            scopeType: 'ORGANIZATION',
            scopeId: principal.organizationId,
            role: { organizationId: principal.organizationId, code: FLEET_MANAGER_ROLE_CODE },
          },
        },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (managers.length === 0) {
      return { evaluatedAt, escalated: 0, skippedNoFleetManager: candidates.length };
    }

    let escalated = 0;
    for (const candidate of candidates) {
      const changed = await this.prisma.$transaction(async (tx) => {
        await this.lockAlert(tx, principal.organizationId, candidate.id);
        const transition = await tx.alert.updateMany({
          where: {
            id: candidate.id,
            organizationId: principal.organizationId,
            escalationDueAt: { lte: evaluatedAt },
            escalatedAt: null,
            exception: { status: 'OPEN' },
          },
          data: { escalatedAt: evaluatedAt },
        });
        if (transition.count === 0) return false;
        await tx.alertEscalation.createMany({
          data: managers.map(({ id }) => ({
            organizationId: principal.organizationId,
            alertId: candidate.id,
            recipientUserId: id,
            escalatedAt: evaluatedAt,
          })),
          skipDuplicates: true,
        });
        await this.audit(tx, principal, 'Alert', candidate.id, 'alert.escalated', {
          evaluatedAt: evaluatedAt.toISOString(),
          fleetManagerUserIds: managers.map(({ id }) => id),
        });
        return true;
      });
      if (changed) escalated += 1;
    }
    return { evaluatedAt, escalated, skippedNoFleetManager: 0 };
  }

  private async lockAlert(tx: Prisma.TransactionClient, organizationId: string, alertId: string) {
    const lockKey = `ALERT:${organizationId}:${alertId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
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
}
