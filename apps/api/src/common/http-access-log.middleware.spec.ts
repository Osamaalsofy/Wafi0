import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { httpAccessLogMiddleware } from './http-access-log.middleware';

describe('httpAccessLogMiddleware', () => {
  it('logs safe request metadata without query strings or headers', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const next = jest.fn() as NextFunction;
    let finish: (() => void) | undefined;
    const request = {
      method: 'GET',
      path: '/api/v1/missions',
      originalUrl: '/api/v1/missions?access_token=secret',
      headers: { authorization: 'Bearer secret-token' },
    } as unknown as Request;
    const response = {
      locals: { requestId: 'request-123' },
      statusCode: 200,
      once: (event: string, listener: () => void) => {
        if (event === 'finish') finish = listener;
        return response;
      },
    } as unknown as Response;

    httpAccessLogMiddleware(request, response, next);
    finish?.();

    expect(next).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'request-123',
        method: 'GET',
        path: '/api/v1/missions',
        statusCode: 200,
        durationMs: expect.any(Number) as number,
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('access_token');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
    log.mockRestore();
  });

  it('uses warning level for unsuccessful requests', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const next = jest.fn() as NextFunction;
    let finish: (() => void) | undefined;
    const request = { method: 'POST', path: '/api/v1/auth/login' } as Request;
    const response = {
      locals: { requestId: 'request-456' },
      statusCode: 401,
      once: (_event: string, listener: () => void) => {
        finish = listener;
        return response;
      },
    } as unknown as Response;

    httpAccessLogMiddleware(request, response, next);
    finish?.();

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'request-456', statusCode: 401 }),
    );
    warn.mockRestore();
  });
});
