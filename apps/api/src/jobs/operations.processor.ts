import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { ContractsService } from '../contracts/contracts.service';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../environment';
import { AlertOperationsService } from '../operational-intelligence/alert-operations.service';
import { RuleReevaluationService } from '../operational-intelligence/rule-reevaluation.service';
import { JOB_NAMES, OPERATIONS_QUEUE, type OperationsJobName } from './job.constants';
import { redisConnection } from './queue.connection';

@Injectable()
export class OperationsProcessor {
  private worker?: Worker;
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
    private readonly rules: RuleReevaluationService,
    private readonly alerts: AlertOperationsService,
    private readonly contracts: ContractsService,
  ) {}

  start() {
    if (this.worker) return;
    this.worker = new Worker(
      OPERATIONS_QUEUE,
      (job) => this.process(job as Job<Record<string, unknown>, unknown, OperationsJobName>),
      {
        connection: redisConnection(this.config.get('REDIS_URL', { infer: true })),
        concurrency: this.config.get('WORKER_CONCURRENCY', { infer: true }),
      },
    );
    this.worker.on('failed', (job, error) => {
      process.stderr.write(
        `${JSON.stringify({ level: 'error', event: 'job.failed', queue: OPERATIONS_QUEUE, jobId: job?.id, jobName: job?.name, attemptsMade: job?.attemptsMade, error: error.message, timestamp: new Date().toISOString() })}\n`,
      );
    });
    this.worker.on('completed', (job) => {
      process.stdout.write(
        `${JSON.stringify({ level: 'info', event: 'job.completed', queue: OPERATIONS_QUEUE, jobId: job.id, jobName: job.name, timestamp: new Date().toISOString() })}\n`,
      );
    });
  }

  close() {
    return this.worker?.close();
  }

  private async process(job: Job<Record<string, unknown>, unknown, OperationsJobName>) {
    if (job.name === JOB_NAMES.documentProcessing || job.name === JOB_NAMES.scheduledReports)
      return { status: 'provider_or_feature_not_configured' };
    const organizations = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    const results = [];
    for (const organization of organizations) {
      const principal = await this.systemPrincipal(organization.id);
      if (!principal) continue;
      const now = new Date();
      if (job.name === JOB_NAMES.slaReevaluation) {
        results.push(
          await this.rules.reevaluate(principal, {
            evaluationAt: now.toISOString(),
            scheduledFrom: new Date(now.getTime() - 48 * 60 * 60_000).toISOString(),
            scheduledTo: new Date(now.getTime() + 60_000).toISOString(),
            maxMissions: 500,
          }),
        );
      } else if (job.name === JOB_NAMES.alertEscalation) {
        results.push(
          await this.alerts.escalateDue(principal, { evaluatedAt: now.toISOString(), limit: 500 }),
        );
      } else if (job.name === JOB_NAMES.contractExpiration) {
        results.push(
          await this.contracts.expireDue(principal, {
            evaluationAt: now.toISOString(),
            limit: 500,
          }),
        );
      } else if (job.name === JOB_NAMES.alertDelivery) {
        results.push({ organizationId: organization.id, status: 'email_transport_pending' });
      } else if (job.name === JOB_NAMES.dailyKpi) {
        results.push({ organizationId: organization.id, status: 'snapshot_selection_pending' });
      } else throw new UnrecoverableError('Unsupported operations job');
    }
    return results;
  }

  private async systemPrincipal(organizationId: string): Promise<AuthenticatedPrincipal | null> {
    const user = await this.prisma.user.findFirst({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    return user ? { userId: user.id, organizationId, email: user.email, grants: [] } : null;
  }
}
