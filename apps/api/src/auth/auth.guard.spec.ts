jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  RecordStatus: { ACTIVE: 'ACTIVE' },
}));

import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';
import type { PrismaService } from '../database/prisma.service';
import { AccessTokenGuard } from './auth.guard';

describe('AccessTokenGuard', () => {
  it('requires the token organization to remain active', async () => {
    let requiredOrganizationStatus: string | undefined;
    const findFirst = jest.fn((args: { where: { organization: { status: string } } }) => {
      requiredOrganizationStatus = args.where.organization.status;
      return Promise.resolve(null);
    });
    const guard = new AccessTokenGuard(
      { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector,
      {
        verifyAsync: jest.fn().mockResolvedValue({
          sub: '8fb687c7-f73f-4f73-b17d-091e148a1412',
          organizationId: 'f125f4ba-f667-4119-b416-30c2e28342b6',
        }),
      } as unknown as JwtService,
      { user: { findFirst } } as unknown as PrismaService,
    );
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer access-token' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow('User is inactive or unavailable');
    expect(requiredOrganizationStatus).toBe('ACTIVE');
  });
});
