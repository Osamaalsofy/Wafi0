import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { AuditContextQueryDto } from './dto/audit-context-query.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) requestedLimit: number,
  ) {
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const safePage = Math.max(page, 1);
    return this.prisma.auditLog.findMany({
      where: { organizationId: principal.organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (safePage - 1) * limit,
      take: limit,
    });
  }

  @Get('context')
  @RequirePermissions('audit.read')
  context(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: AuditContextQueryDto,
  ) {
    const exactType = {
      EXCEPTION: 'OperationalException',
      RULE_CONFIGURATION: 'RuleConfiguration',
      KPI_CONFIGURATION: 'KpiConfiguration',
      CONTRACT: 'OperationalContract',
      ROUTE: 'OperationalRoute',
      MISSION: 'Mission',
      ALERT: 'Alert',
    }[query.contextType];
    const related: Prisma.AuditLogWhereInput[] = [];
    if (query.contextType === 'EXCEPTION') {
      related.push({ newValues: { path: ['exceptionId'], equals: query.contextId } });
    }
    if (query.contextType === 'MISSION') {
      related.push({ newValues: { path: ['missionId'], equals: query.contextId } });
    }
    if (query.contextType === 'ROUTE') {
      related.push({ newValues: { path: ['routeId'], equals: query.contextId } });
    }
    if (query.contextType === 'CONTRACT') {
      related.push({
        AND: [
          { newValues: { path: ['scopeType'], equals: 'CONTRACT' } },
          { newValues: { path: ['scopeId'], equals: query.contextId } },
        ],
      });
    }
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: principal.organizationId,
        OR: [{ entityType: exactType, entityId: query.contextId }, ...related],
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }
}
