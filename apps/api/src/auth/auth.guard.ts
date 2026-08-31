import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RecordStatus } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IS_PUBLIC_KEY } from './auth.decorators';
import type { AccessTokenPayload, AuthenticatedPrincipal } from './auth.types';

interface RequestWithPrincipal extends Request {
  principal?: AuthenticatedPrincipal;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Missing access token');

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          organizationId: payload.organizationId,
          status: RecordStatus.ACTIVE,
          organization: { status: RecordStatus.ACTIVE },
        },
        include: {
          roleAssignments: {
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          },
        },
      });
      if (!user) throw new UnauthorizedException('User is inactive or unavailable');
      request.principal = {
        userId: user.id,
        organizationId: user.organizationId,
        email: user.email,
        grants: user.roleAssignments.flatMap((assignment) =>
          assignment.role.permissions.map(({ permission }) => ({
            permission: permission.code,
            scopeType: assignment.scopeType,
            scopeId: assignment.scopeId,
          })),
        ),
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
