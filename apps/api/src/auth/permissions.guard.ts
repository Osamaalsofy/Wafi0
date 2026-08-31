import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRED_PERMISSIONS_KEY } from './auth.decorators';
import type { AuthenticatedPrincipal } from './auth.types';

interface RequestWithPrincipal extends Request {
  principal?: AuthenticatedPrincipal;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) return true;
    const principal = context.switchToHttp().getRequest<RequestWithPrincipal>().principal;
    if (
      !principal ||
      !required.every((code) =>
        principal.grants.some(
          (grant) =>
            grant.permission === code &&
            grant.scopeType === 'ORGANIZATION' &&
            grant.scopeId === principal.organizationId,
        ),
      )
    ) {
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
