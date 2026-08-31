import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RuleScopeType } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateRuleConfigurationDto } from './dto/create-rule-configuration.dto';
import type { ListRuleConfigurationsQueryDto } from './dto/list-rule-configurations-query.dto';
import { CONTINUOUS_WORKING_CALENDAR } from './working-calendar';

@Injectable()
export class RuleConfigurationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(principal: AuthenticatedPrincipal, query: ListRuleConfigurationsQueryDto) {
    return this.prisma.ruleConfiguration.findMany({
      where: { organizationId: principal.organizationId, ruleCode: query.ruleCode },
      include: { definition: true, owner: { select: { id: true, name: true } } },
      orderBy: [{ ruleCode: 'asc' }, { scopeType: 'asc' }, { scopeId: 'asc' }, { version: 'desc' }],
    });
  }

  async options(principal: AuthenticatedPrincipal) {
    const organizationId = principal.organizationId;
    const [definitions, clients, warehouses, carriers, contracts, users] =
      await this.prisma.$transaction([
        this.prisma.ruleDefinition.findMany({ orderBy: { code: 'asc' } }),
        this.prisma.client.findMany({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true, code: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.warehouse.findMany({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true, clientId: true, code: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.carrier.findMany({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true, code: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.operationalContract.findMany({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true, code: true, name: true, cadence: true, effectiveTo: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.user.findMany({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        }),
      ]);
    return {
      organization: { id: organizationId, name: 'Organization default' },
      definitions,
      scopes: { clients, warehouses, carriers, contracts },
      owners: users,
      unsupportedScopes: ['ROUTE'],
    };
  }

  async create(principal: AuthenticatedPrincipal, input: CreateRuleConfigurationDto) {
    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new ConflictException('effectiveTo must be later than effectiveFrom');
    }
    if (input.timeZone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: input.timeZone }).format();
      } catch {
        throw new ConflictException('timeZone must be a valid IANA time-zone identifier');
      }
    }
    this.validateWorkingCalendar(input.workingCalendar);
    await this.requireDefinition(input.ruleCode);
    await this.requireScope(
      principal.organizationId,
      input.scopeType,
      input.scopeId,
      effectiveFrom,
    );
    if (input.ownerUserId) await this.requireUser(principal.organizationId, input.ownerUserId);
    if (
      (input.ownerScopeType && !input.ownerScopeId) ||
      (!input.ownerScopeType && input.ownerScopeId)
    ) {
      throw new ConflictException('ownerScopeType and ownerScopeId must be provided together');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const versionKey = `RULE_CONFIGURATION:${principal.organizationId}:${input.ruleCode}:${input.scopeType}:${input.scopeId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${versionKey}, 0))`;
        const overlap = await tx.ruleConfiguration.findFirst({
          where: {
            organizationId: principal.organizationId,
            ruleCode: input.ruleCode,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            effectiveFrom: { lt: effectiveTo ?? new Date('9999-12-31T23:59:59.999Z') },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
          },
          select: { id: true },
        });
        if (overlap) throw new ConflictException('Rule configuration effective period overlaps');

        const latest = await tx.ruleConfiguration.findFirst({
          where: {
            organizationId: principal.organizationId,
            ruleCode: input.ruleCode,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
          },
          select: { version: true },
          orderBy: { version: 'desc' },
        });
        const configuration = await tx.ruleConfiguration.create({
          data: {
            organizationId: principal.organizationId,
            ruleCode: input.ruleCode,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            priority: input.priority,
            version: (latest?.version ?? 0) + 1,
            isEnabled: input.isEnabled,
            thresholdMinutes: input.thresholdMinutes,
            quantityTolerance: input.quantityTolerance,
            severity: input.severity,
            isBlocking: input.isBlocking,
            ownerUserId: input.ownerUserId,
            ownerScopeType: input.ownerScopeType,
            ownerScopeId: input.ownerScopeId,
            timeZone: input.timeZone,
            workingCalendar: {
              ...CONTINUOUS_WORKING_CALENDAR,
              ...input.workingCalendar,
            },
            effectiveFrom,
            effectiveTo,
            createdByUserId: principal.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: principal.organizationId,
            actorUserId: principal.userId,
            entityType: 'RuleConfiguration',
            entityId: configuration.id,
            action: 'rule_configuration.version_created',
            newValues: {
              ruleCode: configuration.ruleCode,
              scopeType: configuration.scopeType,
              scopeId: configuration.scopeId,
              priority: configuration.priority,
              version: configuration.version,
              isEnabled: configuration.isEnabled,
              thresholdMinutes: configuration.thresholdMinutes,
              quantityTolerance: configuration.quantityTolerance?.toString() ?? null,
              severity: configuration.severity,
              isBlocking: configuration.isBlocking,
              ownerUserId: configuration.ownerUserId,
              ownerScopeType: configuration.ownerScopeType,
              ownerScopeId: configuration.ownerScopeId,
              timeZone: configuration.timeZone,
              workingCalendar: configuration.workingCalendar,
              effectiveFrom: configuration.effectiveFrom.toISOString(),
              effectiveTo: configuration.effectiveTo?.toISOString() ?? null,
            },
          },
        });
        return configuration;
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  private async requireDefinition(code: string) {
    if (
      !(await this.prisma.ruleDefinition.findUnique({ where: { code }, select: { code: true } }))
    ) {
      throw new NotFoundException('Rule definition not found');
    }
  }

  private validateWorkingCalendar(calendar?: Record<string, unknown>) {
    if (!calendar) return;
    const expectedDays = CONTINUOUS_WORKING_CALENDAR.operatingDays;
    const suppliedDays = calendar.operatingDays;
    if (
      (calendar.mode !== undefined && calendar.mode !== 'CONTINUOUS_24_7') ||
      (calendar.pauseSlaOnWeekends !== undefined && calendar.pauseSlaOnWeekends !== false) ||
      (calendar.pauseSlaOnOfficialHolidays !== undefined &&
        calendar.pauseSlaOnOfficialHolidays !== false) ||
      (calendar.holidayWorkClassification !== undefined &&
        calendar.holidayWorkClassification !== 'OVERTIME') ||
      (suppliedDays !== undefined &&
        (!Array.isArray(suppliedDays) ||
          suppliedDays.length !== expectedDays.length ||
          expectedDays.some((day) => !suppliedDays.includes(day))))
    ) {
      throw new ConflictException(
        'Only the approved continuous 24/7 working calendar is supported',
      );
    }
  }

  private async requireScope(
    organizationId: string,
    scopeType: RuleScopeType,
    scopeId: string,
    effectiveAt: Date,
  ) {
    if (scopeType === 'ORGANIZATION') {
      if (scopeId !== organizationId) throw new NotFoundException('Organization scope not found');
      return;
    }
    if (scopeType === 'ROUTE') {
      throw new ConflictException('Route rule scopes require an approved domain model');
    }
    if (scopeType === 'DRIVER') {
      throw new ConflictException('Driver-specific SLA scopes are not approved');
    }
    if (scopeType === 'CONTRACT') {
      if (
        !(await this.prisma.operationalContract.findFirst({
          where: {
            id: scopeId,
            organizationId,
            status: 'ACTIVE',
            effectiveFrom: { lte: effectiveAt },
            effectiveTo: { gt: effectiveAt },
          },
          select: { id: true },
        }))
      ) {
        throw new NotFoundException('Active contract scope not found');
      }
      return;
    }
    const delegates = {
      CLIENT: () => this.prisma.client.findFirst({ where: { id: scopeId, organizationId } }),
      WAREHOUSE: () => this.prisma.warehouse.findFirst({ where: { id: scopeId, organizationId } }),
      CARRIER: () => this.prisma.carrier.findFirst({ where: { id: scopeId, organizationId } }),
    };
    if (!(await delegates[scopeType]())) throw new NotFoundException('Rule scope not found');
  }

  private async requireUser(organizationId: string, userId: string) {
    if (!(await this.prisma.user.findFirst({ where: { id: userId, organizationId } }))) {
      throw new NotFoundException('Owner user not found');
    }
  }
}
