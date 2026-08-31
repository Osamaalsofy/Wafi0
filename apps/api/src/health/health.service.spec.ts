import { HealthService } from './health.service';
import type { PrismaService } from '../database/prisma.service';

jest.mock('../database/prisma.service', () => ({ PrismaService: class PrismaService {} }));

describe('HealthService', () => {
  const queryRaw = jest.fn();
  const service = new HealthService({ $queryRaw: queryRaw } as unknown as PrismaService);

  beforeEach(() => queryRaw.mockReset());

  it('returns a healthy status', () => {
    const result = service.getStatus();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('wafi-api');
    expect(Date.parse(result.timestamp)).not.toBeNaN();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness after verifying PostgreSQL connectivity', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      service: 'wafi-api',
      checks: { database: 'up' },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports service unavailable when PostgreSQL cannot be reached', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.getReadiness()).rejects.toMatchObject({
      status: 503,
      response: {
        status: 'error',
        service: 'wafi-api',
        checks: { database: 'down' },
      },
    });
  });

  it('bounds readiness when the PostgreSQL query does not settle', async () => {
    jest.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));

    const readiness = service.getReadiness();
    const expectation = expect(readiness).rejects.toMatchObject({
      status: 503,
      response: { status: 'error', checks: { database: 'down' } },
    });
    await jest.advanceTimersByTimeAsync(2_000);

    await expectation;
    jest.useRealTimers();
  });

  it('stops reporting readiness without querying PostgreSQL during shutdown', async () => {
    service.onModuleDestroy();

    await expect(service.getReadiness()).rejects.toMatchObject({
      status: 503,
      response: {
        code: 'SERVICE_SHUTTING_DOWN',
        reason: 'shutting_down',
      },
    });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(service.getStatus().status).toBe('ok');
  });
});
