import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, RuleScopeType } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateKpiConfigurationDto } from './dto/create-kpi-configuration.dto';

@Injectable()
export class KpiConfigurationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(principal: AuthenticatedPrincipal) {
    return this.prisma.kpiConfiguration.findMany({
      where: { organizationId: principal.organizationId },
      include: { definition: true },
      orderBy: [{ kpiCode: 'asc' }, { scopeType: 'asc' }, { scopeId: 'asc' }, { version: 'desc' }],
    });
  }

  async options(principal: AuthenticatedPrincipal) {
    const organizationId = principal.organizationId;
    const [definitions, clients, warehouses, carriers, contracts, drivers] =
      await this.prisma.$transaction([
        this.prisma.kpiDefinition.findMany({ orderBy: { code: 'asc' } }),
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
        this.prisma.driver.findMany({
          where: { organizationId, status: 'ACTIVE' },
          select: { id: true, carrierId: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ]);
    return {
      organization: { id: organizationId, name: 'Organization default' },
      definitions,
      scopes: { clients, warehouses, carriers, contracts, drivers },
      unsupportedScopes: ['ROUTE'],
      calculationAvailable: true,
    };
  }

  async create(principal: AuthenticatedPrincipal, input: CreateKpiConfigurationDto) {
    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new ConflictException('effectiveTo must be later than effectiveFrom');
    }
    if (input.timeZone) this.validateTimeZone(input.timeZone);
    if (!(await this.prisma.kpiDefinition.findUnique({ where: { code: input.kpiCode } }))) {
      throw new NotFoundException('KPI definition not found');
    }
    await this.requireScope(
      principal.organizationId,
      input.scopeType,
      input.scopeId,
      effectiveFrom,
    );
    return this.prisma.$transaction(
      async (tx) => {
        const versionKey = `KPI_CONFIGURATION:${principal.organizationId}:${input.kpiCode}:${input.scopeType}:${input.scopeId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${versionKey}, 0))`;
        const overlap = await tx.kpiConfiguration.findFirst({
          where: {
            organizationId: principal.organizationId,
            kpiCode: input.kpiCode,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            effectiveFrom: { lt: effectiveTo ?? new Date('9999-12-31T23:59:59.999Z') },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
          },
          select: { id: true },
        });
        if (overlap) throw new ConflictException('KPI configuration effective period overlaps');

        const latest = await tx.kpiConfiguration.findFirst({
          where: {
            organizationId: principal.organizationId,
            kpiCode: input.kpiCode,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
          },
          select: { version: true },
          orderBy: { version: 'desc' },
        });
        const configuration = await tx.kpiConfiguration.create({
          data: {
            organizationId: principal.organizationId,
            kpiCode: input.kpiCode,
            scopeType: input.scopeType,
            scopeId: input.scopeId,
            version: (latest?.version ?? 0) + 1,
            isEnabled: input.isEnabled,
            formula: input.formula as Prisma.InputJsonValue | undefined,
            eligibility: input.eligibility as Prisma.InputJsonValue | undefined,
            dataSources: input.dataSources as Prisma.InputJsonValue | undefined,
            periodDefinition: input.periodDefinition as Prisma.InputJsonValue | undefined,
            targets: input.targets as Prisma.InputJsonValue | undefined,
            targetPercent: input.targetPercent ?? 90,
            roundingMode: input.roundingMode,
            decimalScale: input.decimalScale,
            calculationFrequency: input.calculationFrequency ?? 'DAILY',
            timeZone: input.timeZone,
            effectiveFrom,
            effectiveTo,
            createdByUserId: principal.userId,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: principal.organizationId,
            actorUserId: principal.userId,
            entityType: 'KpiConfiguration',
            entityId: configuration.id,
            action: 'kpi_configuration.version_created',
            newValues: {
              kpiCode: configuration.kpiCode,
              scopeType: configuration.scopeType,
              scopeId: configuration.scopeId,
              version: configuration.version,
              isEnabled: configuration.isEnabled,
              formula: configuration.formula,
              eligibility: configuration.eligibility,
              dataSources: configuration.dataSources,
              periodDefinition: configuration.periodDefinition,
              targets: configuration.targets,
              targetPercent: configuration.targetPercent.toString(),
              roundingMode: configuration.roundingMode,
              decimalScale: configuration.decimalScale,
              calculationFrequency: configuration.calculationFrequency,
              timeZone: configuration.timeZone,
              effectiveFrom: configuration.effectiveFrom.toISOString(),
              effectiveTo: configuration.effectiveTo?.toISOString() ?? null,
              calculationExecuted: false,
            },
          },
        });
        return configuration;
      },
      { isolationLevel: 'ReadCommitted' },
    );
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
      throw new ConflictException('Route KPI scopes require an approved domain model');
    }
    if (scopeType === 'DRIVER') {
      if (
        !(await this.prisma.driver.findFirst({
          where: { id: scopeId, organizationId, status: 'ACTIVE' },
          select: { id: true },
        }))
      ) {
        throw new NotFoundException('Active driver scope not found');
      }
      return;
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
    if (!(await delegates[scopeType]())) throw new NotFoundException('KPI scope not found');
  }

  private validateTimeZone(timeZone: string) {
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
    } catch {
      throw new ConflictException('timeZone must be a valid IANA time-zone identifier');
    }
  }
}
