import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface HttpErrorBody {
  message?: string | string[];
  error?: string;
  code?: string;
  checks?: { database?: 'down' };
  reason?: 'shutting_down';
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isUniqueConflict = this.isUniqueConstraintError(exception);
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : isUniqueConflict
          ? HttpStatus.CONFLICT
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: HttpErrorBody =
      typeof raw === 'string'
        ? { message: raw }
        : ((raw as HttpErrorBody | undefined) ??
          (isUniqueConflict ? { message: 'Resource already exists', error: 'Conflict' } : {}));
    const messages = Array.isArray(body.message) ? body.message : undefined;
    const rawRequestId = (response.locals as Record<string, unknown>).requestId;
    const requestId = typeof rawRequestId === 'string' ? rawRequestId : 'unknown';
    const path = request.path;
    const isServerError = statusCode >= 500;
    const isReadinessFailure =
      exception instanceof ServiceUnavailableException &&
      ((body.code === 'SERVICE_NOT_READY' && body.checks?.database === 'down') ||
        (body.code === 'SERVICE_SHUTTING_DOWN' && body.reason === 'shutting_down'));

    if (isServerError && !isReadinessFailure) {
      const error = exception instanceof Error ? exception : new Error('Unknown exception');
      this.logger.error({
        message: 'Unhandled request failure',
        requestId,
        method: request.method,
        path,
        statusCode,
        stack: error.stack,
      });
    }

    response.status(statusCode).json({
      statusCode,
      code:
        (isReadinessFailure ? body.code : undefined) ??
        (isServerError ? 'INTERNAL_SERVER_ERROR' : body.code) ??
        body.error?.toUpperCase().replaceAll(' ', '_') ??
        'REQUEST_FAILED',
      message: isReadinessFailure
        ? body.message
        : isServerError
          ? 'An unexpected server error occurred'
          : messages
            ? 'Request validation failed'
            : (body.message ?? 'Request failed'),
      ...(messages ? { details: messages } : {}),
      ...(isReadinessFailure
        ? {
            status: 'error' as const,
            service: 'wafi-api' as const,
            ...(body.code === 'SERVICE_SHUTTING_DOWN'
              ? { reason: 'shutting_down' as const }
              : { checks: { database: 'down' as const } }),
          }
        : {}),
      requestId,
      timestamp: new Date().toISOString(),
      path,
    });
  }

  private isUniqueConstraintError(exception: unknown): exception is Error & { code: 'P2002' } {
    return (
      exception instanceof Error &&
      'code' in exception &&
      (exception as Error & { code?: unknown }).code === 'P2002'
    );
  }
}
