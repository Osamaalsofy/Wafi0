import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContractPartyType, Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import type { ExpireContractsDto } from './dto/expire-contracts.dto';
import type { TransitionContractDto } from './dto/transition-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal, query: ListContractsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.OperationalContractWhereInput = {
      organizationId: principal.organizationId,
      status: query.status,
      cadence: query.cadence,
      parties: query.clientId
        ? { some: { partyType: 'CLIENT', partyId: query.clientId } }
        : undefined,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.operationalContract.findMany({
        where,
        include: { parties: { orderBy: [{ partyType: 'asc' }, { partyId: 'asc' }] } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.operationalContract.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(principal: AuthenticatedPrincipal, id: string) {
    const contract = await this.prisma.operationalContract.findFirst({
      where: { id, organizationId: principal.organizationId },
      include: { parties: { orderBy: [{ partyType: 'asc' }, { partyId: 'asc' }] } },
    });
    if (!contract) throw new NotFoundException('Operational contract not found');
    return contract;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateContractDto) {
    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = new Date(input.effectiveTo);
    if (effectiveTo <= effectiveFrom) {
      throw new ConflictException('effectiveTo must be later than effectiveFrom');
    }
    if (
      input.temperatureMonitoringRequired &&
      (input.minimumTemperature === undefined ||
        input.maximumTemperature === undefined ||
        input.temperatureGraceMinutes === undefined)
    ) {
      throw new ConflictException(
        'Temperature range and grace duration are required when monitoring is enabled',
      );
    }
    if (
      input.minimumTemperature !== undefined &&
      input.maximumTemperature !== undefined &&
      input.minimumTemperature > input.maximumTemperature
    ) {
      throw new ConflictException('minimumTemperature cannot exceed maximumTemperature');
    }
    const code = input.code.toUpperCase();
    if (
      await this.prisma.operationalContract.findUnique({
        where: { organizationId_code: { organizationId: principal.organizationId, code } },
        select: { id: true },
      })
    ) {
      throw new ConflictException('Contract code already exists in this organization');
    }

    const parties = [
      { partyType: 'ORGANIZATION' as const, partyId: principal.organizationId },
      ...input.parties,
    ];
    if (!parties.some(({ partyType }) => partyType === 'CLIENT')) {
      throw new ConflictException('At least one client party is required');
    }
    const keys = parties.map(({ partyType, partyId }) => `${partyType}:${partyId}`);
    if (new Set(keys).size !== keys.length) {
      throw new ConflictException('Contract parties must be unique');
    }
    await Promise.all(
      parties.map(({ partyType, partyId }) =>
        this.requireParty(principal.organizationId, partyType, partyId),
      ),
    );

    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.operationalContract.create({
        data: {
          organizationId: principal.organizationId,
          code,
          name: input.name.trim(),
          cadence: input.cadence,
          status: 'DRAFT',
          effectiveFrom,
          effectiveTo,
          temperatureMonitoringRequired: input.temperatureMonitoringRequired,
          minimumTemperature: input.minimumTemperature,
          maximumTemperature: input.maximumTemperature,
          temperatureGraceMinutes: input.temperatureGraceMinutes,
          temperatureSensorReference: input.temperatureSensorReference?.trim(),
          createdByUserId: principal.userId,
          parties: {
            create: parties.map(({ partyType, partyId }) => ({
              partyType,
              partyId,
            })),
          },
        },
        include: { parties: { orderBy: [{ partyType: 'asc' }, { partyId: 'asc' }] } },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'OperationalContract',
          entityId: contract.id,
          action: 'contract.created',
          newValues: {
            code: contract.code,
            name: contract.name,
            cadence: contract.cadence,
            status: contract.status,
            effectiveFrom: contract.effectiveFrom.toISOString(),
            effectiveTo: contract.effectiveTo.toISOString(),
            parties: parties.map(({ partyType, partyId }) => ({ partyType, partyId })),
          },
        },
      });
      return contract;
    });
  }

  async transition(principal: AuthenticatedPrincipal, id: string, input: TransitionContractDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockContract(tx, principal.organizationId, id);
      const current = await tx.operationalContract.findFirst({
        where: { id, organizationId: principal.organizationId },
        include: { parties: { orderBy: [{ partyType: 'asc' }, { partyId: 'asc' }] } },
      });
      if (!current) throw new NotFoundException('Operational contract not found');
      if (current.status === input.status) return current;
      const allowed = {
        DRAFT: ['ACTIVE', 'TERMINATED'],
        ACTIVE: ['SUSPENDED', 'TERMINATED'],
        SUSPENDED: ['ACTIVE', 'TERMINATED'],
        EXPIRED: [],
        TERMINATED: [],
      } as const;
      if (!(allowed[current.status] as readonly string[]).includes(input.status)) {
        throw new ConflictException(
          `Contract cannot transition from ${current.status} to ${input.status}`,
        );
      }
      if (input.status === 'ACTIVE' && current.effectiveTo <= new Date()) {
        throw new ConflictException('Expired-date contracts cannot be activated');
      }
      const changed = await tx.operationalContract.updateMany({
        where: { id, organizationId: principal.organizationId, status: current.status },
        data: { status: input.status },
      });
      const updated = await tx.operationalContract.findUniqueOrThrow({
        where: { id },
        include: { parties: { orderBy: [{ partyType: 'asc' }, { partyId: 'asc' }] } },
      });
      if (changed.count === 0) return updated;
      await this.auditStatus(
        tx,
        principal,
        updated.id,
        'contract.status_changed',
        current.status,
        input.status,
        undefined,
        input.reason?.trim(),
      );
      return updated;
    });
  }

  async expireDue(principal: AuthenticatedPrincipal, input: ExpireContractsDto) {
    const evaluationAt = new Date(input.evaluationAt);
    return this.prisma.$transaction(async (tx) => {
      const due = await tx.operationalContract.findMany({
        where: {
          organizationId: principal.organizationId,
          status: { in: ['ACTIVE', 'SUSPENDED'] },
          effectiveTo: { lte: evaluationAt },
        },
        select: { id: true, status: true },
        orderBy: [{ effectiveTo: 'asc' }, { id: 'asc' }],
        take: input.limit,
      });
      const expiredIds: string[] = [];
      for (const contract of due) {
        await this.lockContract(tx, principal.organizationId, contract.id);
        const changed = await tx.operationalContract.updateMany({
          where: {
            id: contract.id,
            organizationId: principal.organizationId,
            status: contract.status,
            effectiveTo: { lte: evaluationAt },
          },
          data: { status: 'EXPIRED' },
        });
        if (changed.count !== 1) continue;
        expiredIds.push(contract.id);
        await this.auditStatus(
          tx,
          principal,
          contract.id,
          'contract.expired',
          contract.status,
          'EXPIRED',
          evaluationAt,
        );
      }
      return { evaluationAt, expiredIds, remainingMayExist: due.length === input.limit };
    });
  }

  private lockContract(tx: Prisma.TransactionClient, organizationId: string, id: string) {
    const lockKey = `OPERATIONAL_CONTRACT:${organizationId}:${id}`;
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
  }

  private auditStatus(
    tx: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    id: string,
    action: string,
    oldStatus: string,
    newStatus: string,
    evaluationAt?: Date,
    reason?: string,
  ) {
    return tx.auditLog.create({
      data: {
        organizationId: principal.organizationId,
        actorUserId: principal.userId,
        entityType: 'OperationalContract',
        entityId: id,
        action,
        oldValues: { status: oldStatus },
        newValues: {
          status: newStatus,
          ...(evaluationAt ? { evaluationAt: evaluationAt.toISOString() } : {}),
          ...(reason ? { reason } : {}),
        },
      },
    });
  }

  private async requireParty(
    organizationId: string,
    partyType: ContractPartyType,
    partyId: string,
  ) {
    if (partyType === 'ORGANIZATION') {
      if (partyId !== organizationId) throw new NotFoundException('Organization party not found');
      return;
    }
    const delegates = {
      CLIENT: () =>
        this.prisma.client.findFirst({ where: { id: partyId, organizationId, status: 'ACTIVE' } }),
      CARRIER: () =>
        this.prisma.carrier.findFirst({ where: { id: partyId, organizationId, status: 'ACTIVE' } }),
      DRIVER: () =>
        this.prisma.driver.findFirst({ where: { id: partyId, organizationId, status: 'ACTIVE' } }),
    };
    if (!(await delegates[partyType]()))
      throw new NotFoundException(`Active ${partyType.toLowerCase()} party not found`);
  }
}
