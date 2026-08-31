jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));

import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Environment } from '../environment';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController refresh cookie', () => {
  const tokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 900,
  };

  function setup(nodeEnv: Environment['NODE_ENV'] = 'production') {
    const login = jest.fn().mockResolvedValue(tokens);
    const refresh = jest.fn().mockResolvedValue(tokens);
    const logout = jest.fn().mockResolvedValue(undefined);
    const auth = {
      login,
      refresh,
      logout,
    } as unknown as AuthService;
    const config = {
      get: jest.fn((key: keyof Environment) =>
        key === 'NODE_ENV' ? nodeEnv : key === 'REFRESH_TOKEN_TTL_DAYS' ? 30 : undefined,
      ),
    } as unknown as ConfigService<Environment, true>;
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    const response = { cookie, clearCookie } as unknown as Response;
    return { controller: new AuthController(auth, config), response, cookie, refresh };
  }

  it('keeps the refresh token out of the login body and stores it in a protected cookie', async () => {
    const { controller, response, cookie } = setup();

    const result = await controller.login(
      { organizationCode: 'wafi', email: 'operator@example.com', password: 'password123' },
      response,
    );

    expect(result).toEqual({ accessToken: 'access-token', expiresIn: 900 });
    expect(cookie).toHaveBeenCalledWith(
      'wafi_refresh_token',
      'refresh-token',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict' }),
    );
  });

  it('rotates using only the protected cookie', async () => {
    const { controller, response, cookie, refresh } = setup('test');
    const request = {
      headers: { cookie: 'other=value; wafi_refresh_token=original-refresh-token' },
    } as Request;

    const result = await controller.refresh(request, response);

    expect(refresh).toHaveBeenCalledWith('original-refresh-token');
    expect(result).toEqual({ accessToken: 'access-token', expiresIn: 900 });
    expect(cookie).toHaveBeenCalledWith(
      'wafi_refresh_token',
      'refresh-token',
      expect.objectContaining({ httpOnly: true, secure: false }),
    );
  });

  it('rejects refresh without the cookie', async () => {
    const { controller, response } = setup();

    await expect(controller.refresh({ headers: {} } as Request, response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns the guard-resolved current user and authorization grants', () => {
    const { controller } = setup();
    const principal = {
      userId: 'user-id',
      organizationId: 'organization-id',
      email: 'operator@example.com',
      grants: [
        {
          permission: 'mission.read',
          scopeType: 'ORGANIZATION' as const,
          scopeId: 'organization-id',
        },
      ],
    };

    expect(controller.currentUser(principal)).toBe(principal);
  });
});
