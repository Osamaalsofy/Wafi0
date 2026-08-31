import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedPrincipal } from '../auth/auth.types';

const WINDOW_MS = 60_000;
const LIMIT = 6;

interface RequestWithPrincipal extends Request {
  principal?: AuthenticatedPrincipal;
}

interface RateWindow {
  startedAt: number;
  attempts: number;
}

@Injectable()
export class ReevaluationThrottleGuard implements CanActivate, OnModuleDestroy {
  private readonly windows = new Map<string, RateWindow>();
  private lastSweepAt = 0;

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithPrincipal>();
    const response = http.getResponse<Response>();
    const principal = request.principal;
    if (!principal) throw new UnauthorizedException('Authenticated principal is required');

    const now = Date.now();
    this.sweepExpiredWindows(now);
    const key = `${principal.organizationId}:${principal.userId}`;
    const current = this.windows.get(key);
    const window =
      !current || now - current.startedAt >= WINDOW_MS ? { startedAt: now, attempts: 0 } : current;
    const resetAfterSeconds = Math.max(1, Math.ceil((window.startedAt + WINDOW_MS - now) / 1000));

    if (window.attempts >= LIMIT) {
      response.setHeader('Retry-After', String(resetAfterSeconds));
      throw new ThrottlerException('Too many reevaluation requests');
    }

    window.attempts += 1;
    this.windows.set(key, window);
    response.setHeader('X-RateLimit-Limit-Reevaluation', String(LIMIT));
    response.setHeader(
      'X-RateLimit-Remaining-Reevaluation',
      String(Math.max(0, LIMIT - window.attempts)),
    );
    response.setHeader('X-RateLimit-Reset-Reevaluation', String(resetAfterSeconds));
    return true;
  }

  onModuleDestroy(): void {
    this.windows.clear();
  }

  private sweepExpiredWindows(now: number): void {
    if (now - this.lastSweepAt < WINDOW_MS) return;
    this.lastSweepAt = now;
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= WINDOW_MS) this.windows.delete(key);
    }
  }
}
