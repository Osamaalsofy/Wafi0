import {
  HttpException,
  Logger,
  ServiceUnavailableException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  const status = jest.fn();
  const json = jest.fn();
  const response = {
    locals: { requestId: 'request-123' },
    status,
    json,
  } as unknown as Response;
  const request = {
    method: 'GET',
    path: '/api/v1/failure',
    originalUrl: '/api/v1/failure?access_token=secret',
  } as Request;
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as ArgumentsHost;

  beforeEach(() => {
    status.mockReset().mockReturnValue(response);
    json.mockReset();
  });

  it('sanitizes every server error and excludes the query string', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    new ApiExceptionFilter().catch(
      new HttpException({ message: 'upstream password leaked' }, 502),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred',
        path: '/api/v1/failure',
      }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('password');
    expect(JSON.stringify(log.mock.calls)).not.toContain('access_token');
    log.mockRestore();
  });

  it('preserves only the explicit safe readiness contract', () => {
    new ApiExceptionFilter().catch(
      new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'The API is not ready to receive traffic',
        checks: { database: 'down' },
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'SERVICE_NOT_READY',
        checks: { database: 'down' },
        path: '/api/v1/failure',
      }),
    );
  });

  it('preserves the explicit safe shutdown readiness contract', () => {
    new ApiExceptionFilter().catch(
      new ServiceUnavailableException({
        code: 'SERVICE_SHUTTING_DOWN',
        message: 'The API is shutting down',
        reason: 'shutting_down',
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'SERVICE_SHUTTING_DOWN',
        status: 'error',
        service: 'wafi-api',
        reason: 'shutting_down',
      }),
    );
  });

  it('translates a concurrent unique-constraint race into a sanitized conflict', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const exception = Object.assign(new Error('Unique constraint failed for secret tenant data'), {
      code: 'P2002',
      meta: { target: ['organization_id', 'code'], value: 'secret-code' },
    });

    new ApiExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Resource already exists',
      }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret-code');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
