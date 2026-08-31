import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HttpAccess');

export function httpAccessLogMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();

  response.once('finish', () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    const rawRequestId = (response.locals as Record<string, unknown>).requestId;
    const entry = {
      message: 'HTTP request completed',
      requestId: typeof rawRequestId === 'string' ? rawRequestId : 'unknown',
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Number(elapsedNanoseconds) / 1_000_000,
    };

    if (response.statusCode >= 400) logger.warn(entry);
    else logger.log(entry);
  });

  next();
}
