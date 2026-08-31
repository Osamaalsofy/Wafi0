import {
  Injectable,
  ServiceUnavailableException,
  type BeforeApplicationShutdown,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';

const DATABASE_READINESS_TIMEOUT_MS = 2_000;

export interface HealthStatus {
  status: 'ok';
  service: 'wafi-api';
  timestamp: string;
}

export interface ReadinessStatus extends HealthStatus {
  checks: {
    database: 'up';
    redis: 'up';
    queue: 'up';
    workers: number;
  };
}

export interface ReadinessFailure {
  status: 'error';
  service: 'wafi-api';
  timestamp: string;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    queue: 'up' | 'down';
  };
}

@Injectable()
export class HealthService implements OnModuleDestroy, BeforeApplicationShutdown {
  private shuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs?: JobsService,
  ) {}

  onModuleDestroy(): void {
    this.shuttingDown = true;
  }

  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }

  getStatus(): HealthStatus {
    return { status: 'ok', service: 'wafi-api', timestamp: new Date().toISOString() };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    if (this.shuttingDown) {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'wafi-api',
        code: 'SERVICE_SHUTTING_DOWN',
        message: 'The API is shutting down',
        reason: 'shutting_down',
        timestamp: new Date().toISOString(),
      });
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let database: 'up' | 'down' = 'down';
    let redis: 'up' | 'down' = this.jobs ? 'down' : 'up';
    let queue: 'up' | 'down' = this.jobs ? 'down' : 'up';
    let workers = 0;

    try {
      const [, queueHealth] = await Promise.race([
        Promise.all([this.prisma.$queryRaw`SELECT 1`, this.jobs?.health()]),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Database readiness check timed out')),
            DATABASE_READINESS_TIMEOUT_MS,
          );
        }),
      ]);
      database = 'up';
      if (queueHealth) {
        redis = 'up';
        queue = 'up';
        workers = queueHealth.workers.connected;
        if (!queueHealth.workers.healthy) throw new Error('No operations worker is connected');
      }
    } catch {
      const response: ReadinessFailure = {
        status: 'error',
        service: 'wafi-api',
        timestamp: new Date().toISOString(),
        checks: { database, redis, queue },
      };
      throw new ServiceUnavailableException({
        ...response,
        code: 'SERVICE_NOT_READY',
        message: 'The API is not ready to receive traffic',
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    return {
      ...this.getStatus(),
      checks: { database: 'up', redis: 'up', queue: 'up', workers },
    };
  }
}
