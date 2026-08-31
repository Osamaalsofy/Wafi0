import { hash } from 'bcryptjs';

jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { AuthService } from './auth.service';
import type { PrismaService } from '../database/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../environment';

describe('AuthService', () => {
  it('issues an access token and stores only a hashed refresh token', async () => {
    const password = 'a-secure-password';
    const user = {
      id: '8fb687c7-f73f-4f73-b17d-091e148a1412',
      organizationId: 'f125f4ba-f667-4119-b416-30c2e28342b6',
      email: 'operator@example.com',
      passwordHash: await hash(password, 4),
      status: 'ACTIVE' as const,
    };
    let storedTokenHash: string | undefined;
    const createSession = jest.fn((args: { data: { tokenHash: string } }) => {
      storedTokenHash = args.data.tokenHash;
      return Promise.resolve({ id: 'session-id' });
    });
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
      refreshSession: { create: createSession },
    } as unknown as PrismaService;
    const signAsync = jest.fn().mockResolvedValue('signed-access-token');
    const jwt = { signAsync } as unknown as JwtService;
    const config = {
      get: jest.fn((key: keyof Environment) =>
        key === 'JWT_ACCESS_TTL_SECONDS' ? 900 : key === 'REFRESH_TOKEN_TTL_DAYS' ? 30 : undefined,
      ),
    } as unknown as ConfigService<Environment, true>;

    const tokens = await new AuthService(prisma, jwt, config).login({
      organizationCode: 'wafi',
      email: user.email,
      password,
    });

    expect(tokens.accessToken).toBe('signed-access-token');
    expect(tokens.refreshToken).toHaveLength(64);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(storedTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedTokenHash).not.toBe(tokens.refreshToken);
  });

  it('allows only one concurrent rotation of the same refresh token', async () => {
    const user = {
      id: '8fb687c7-f73f-4f73-b17d-091e148a1412',
      organizationId: 'f125f4ba-f667-4119-b416-30c2e28342b6',
      status: 'ACTIVE' as const,
      organization: { status: 'ACTIVE' as const },
    };
    const session = {
      id: '1d3023ce-fe7e-4b17-a737-5799440c5635',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    };
    const updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const create = jest.fn().mockResolvedValue({ id: 'replacement-session-id' });
    const transaction = jest.fn(
      async (
        callback: (tx: {
          refreshSession: { updateMany: typeof updateMany; create: typeof create };
        }) => Promise<void>,
      ) => callback({ refreshSession: { updateMany, create } }),
    );
    const prisma = {
      refreshSession: { findUnique: jest.fn().mockResolvedValue(session) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const signAsync = jest.fn().mockResolvedValue('signed-access-token');
    const jwt = { signAsync } as unknown as JwtService;
    const config = {
      get: jest.fn((key: keyof Environment) =>
        key === 'JWT_ACCESS_TTL_SECONDS' ? 900 : key === 'REFRESH_TOKEN_TTL_DAYS' ? 30 : undefined,
      ),
    } as unknown as ConfigService<Environment, true>;
    const service = new AuthService(prisma, jwt, config);

    const results = await Promise.allSettled([
      service.refresh('one-time-refresh-token'),
      service.refresh('one-time-refresh-token'),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(signAsync).toHaveBeenCalledTimes(1);
  });

  it('rejects refresh sessions after the organization is deactivated', async () => {
    const transaction = jest.fn();
    const prisma = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: '1d3023ce-fe7e-4b17-a737-5799440c5635',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: '8fb687c7-f73f-4f73-b17d-091e148a1412',
            organizationId: 'f125f4ba-f667-4119-b416-30c2e28342b6',
            status: 'ACTIVE',
            organization: { status: 'INACTIVE' },
          },
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new AuthService(
      prisma,
      { signAsync: jest.fn() } as unknown as JwtService,
      { get: jest.fn() } as unknown as ConfigService<Environment, true>,
    );

    await expect(service.refresh('refresh-token')).rejects.toThrow('Invalid refresh token');
    expect(transaction).not.toHaveBeenCalled();
  });
});
