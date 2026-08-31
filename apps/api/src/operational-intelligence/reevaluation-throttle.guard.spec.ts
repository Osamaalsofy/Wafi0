import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ReevaluationThrottleGuard } from './reevaluation-throttle.guard';

function contextFor(userId?: string, organizationId = 'organization-id') {
  const setHeader = jest.fn();
  const request = {
    principal: userId
      ? { userId, organizationId, email: `${userId}@example.com`, grants: [] }
      : undefined,
  } as unknown as Request;
  const response = { setHeader } as unknown as Response;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;
  return { context, setHeader };
}

describe('ReevaluationThrottleGuard', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(1_000_000));
  afterEach(() => jest.restoreAllMocks());

  it('allows six attempts and blocks the seventh for the same tenant user', () => {
    const guard = new ReevaluationThrottleGuard();
    const { context, setHeader } = contextFor('user-a');

    for (let attempt = 0; attempt < 6; attempt += 1) expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(ThrottlerException);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('isolates rate windows by organization and user', () => {
    const guard = new ReevaluationThrottleGuard();
    const first = contextFor('user-a');
    for (let attempt = 0; attempt < 6; attempt += 1) guard.canActivate(first.context);

    expect(guard.canActivate(contextFor('user-b').context)).toBe(true);
    expect(guard.canActivate(contextFor('user-a', 'other-organization').context)).toBe(true);
  });

  it('requires the authenticated principal installed by the global auth guard', () => {
    expect(() => new ReevaluationThrottleGuard().canActivate(contextFor().context)).toThrow(
      UnauthorizedException,
    );
  });
});
