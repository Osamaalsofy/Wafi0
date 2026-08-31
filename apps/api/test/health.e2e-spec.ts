import { Test } from '@nestjs/testing';
import { type INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/database/prisma.service';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { ConfigModule } from '@nestjs/config';
import { JobsService } from '../src/jobs/jobs.service';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;
  let databaseError: Error | undefined;
  let queryCount = 0;
  const queryRaw = (): Promise<unknown[]> => {
    queryCount += 1;
    if (databaseError) return Promise.reject(databaseError);
    return Promise.resolve([{ '?column?': 1 }]);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .overrideProvider(JobsService)
      .useValue({
        health: () =>
          Promise.resolve({
            status: 'disabled',
            workers: { connected: 0, required: false, healthy: true },
          }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    databaseError = undefined;
    queryCount = 0;
  });

  it('GET /api/v1/health', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/api/v1/health').expect(200);
    const body = response.body as { status: unknown };
    expect(body.status).toBe('ok');
    expect(queryCount).toBe(0);
  });

  it('GET /api/v1/health/ready returns 200 when PostgreSQL is reachable', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/api/v1/health/ready').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', checks: { database: 'up' } });
    expect(queryCount).toBe(1);
  });

  it('GET /api/v1/health/ready returns 503 when PostgreSQL is unavailable', async () => {
    databaseError = new Error('connection refused');

    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/api/v1/health/ready').expect(503);
    expect(response.body).toMatchObject({
      status: 'error',
      service: 'wafi-api',
      checks: { database: 'down' },
    });
  });
});
