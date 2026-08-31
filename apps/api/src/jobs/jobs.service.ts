import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { Environment } from '../environment';
import { JOB_NAMES, OPERATIONS_QUEUE, type OperationsJobName } from './job.constants';
import { redisConnection } from './queue.connection';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  readonly queue?: Queue;
  constructor(private readonly config: ConfigService<Environment, true>) {
    if (!config.get('BACKGROUND_JOBS_ENABLED', { infer: true })) return;
    this.queue = new Queue(OPERATIONS_QUEUE, {
      connection: redisConnection(config.get('REDIS_URL', { infer: true })),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400, count: 5_000 },
        removeOnFail: false,
      },
    });
  }

  async onModuleInit() {
    if (!this.config.get('BACKGROUND_JOBS_ENABLED', { infer: true })) return;
    await Promise.all([
      this.schedule(JOB_NAMES.slaReevaluation, 5 * 60_000),
      this.schedule(JOB_NAMES.alertDelivery, 60_000),
      this.schedule(JOB_NAMES.alertEscalation, 60_000),
      this.schedule(JOB_NAMES.contractExpiration, 5 * 60_000),
      this.schedule(JOB_NAMES.dailyKpi, 24 * 60 * 60_000),
    ]);
  }

  async enqueue(name: OperationsJobName, data: Record<string, unknown>, idempotencyKey: string) {
    return this.requireQueue().add(name, data, { jobId: `${name}-${idempotencyKey}` });
  }

  async health() {
    if (!this.config.get('BACKGROUND_JOBS_ENABLED', { infer: true })) {
      return {
        status: 'disabled' as const,
        queue: OPERATIONS_QUEUE,
        counts: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
        workers: { connected: 0, required: false, healthy: true },
        deadLetter: { count: 0, alert: false, latest: [] },
      };
    }
    const queue = this.requireQueue();
    await queue.waitUntilReady();
    const [counts, workers, failed] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
      queue.getWorkers(),
      queue.getFailed(0, 9),
    ]);
    return {
      status: 'up' as const,
      queue: OPERATIONS_QUEUE,
      counts,
      workers: {
        connected: workers.length,
        required: this.config.get('BACKGROUND_JOBS_ENABLED', { infer: true }),
        healthy: !this.config.get('BACKGROUND_JOBS_ENABLED', { infer: true }) || workers.length > 0,
      },
      deadLetter: {
        count: counts.failed,
        alert: counts.failed >= this.config.get('FAILED_JOB_ALERT_THRESHOLD', { infer: true }),
        latest: failed.map((job) => ({
          id: job.id,
          name: job.name,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          finishedOn: job.finishedOn,
        })),
      },
    };
  }

  async failed(limit = 25) {
    if (!this.queue) return [];
    const jobs = await this.queue.getFailed(0, Math.min(Math.max(limit, 1), 100) - 1);
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
    }));
  }

  onModuleDestroy() {
    return this.queue?.close();
  }

  private schedule(name: OperationsJobName, every: number) {
    return this.requireQueue().upsertJobScheduler(
      `${name}-scheduler-v1`,
      { every },
      { name, data: {}, opts: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } } },
    );
  }

  private requireQueue() {
    if (!this.queue) throw new Error('Background jobs are disabled');
    return this.queue;
  }
}
