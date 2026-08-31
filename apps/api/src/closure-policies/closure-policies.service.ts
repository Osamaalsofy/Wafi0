import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { ListClosurePoliciesQueryDto } from './dto/list-closure-policies-query.dto';
import type { SaveClosurePolicyDto } from './dto/save-closure-policy.dto';

@Injectable()
export class ClosurePoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  list(principal: AuthenticatedPrincipal, query: ListClosurePoliciesQueryDto) {
    return this.prisma.closurePolicy.findMany({
      where: {
        organizationId: principal.organizationId,
        clientId: query.clientId,
        stage: query.stage,
      },
      include: this.relations,
      orderBy: [{ clientId: 'asc' }, { stage: 'asc' }, { version: 'desc' }],
    });
  }

  async save(principal: AuthenticatedPrincipal, input: SaveClosurePolicyDto) {
    await this.requireActiveClient(principal.organizationId, input.clientId);
    this.requireUniqueRequirements(input);
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `CLOSURE_POLICY:${principal.organizationId}:${input.clientId}:${input.stage}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const current = await tx.closurePolicy.findFirst({
        where: {
          clientId: input.clientId,
          stage: input.stage,
          organizationId: principal.organizationId,
        },
        include: { requirements: true },
        orderBy: { version: 'desc' },
      });
      if (current?.status === 'DRAFT')
        throw new ConflictException('A draft version already exists');
      const policy = await tx.closurePolicy.create({
        data: {
          organizationId: principal.organizationId,
          clientId: input.clientId,
          stage: input.stage,
          version: (current?.version ?? 0) + 1,
          status: 'DRAFT',
          authoredByUserId: principal.userId,
        },
      });
      if (input.requirements.length) {
        await tx.closureDocumentRequirement.createMany({
          data: input.requirements.map((requirement) => ({ policyId: policy.id, ...requirement })),
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'ClosurePolicy',
          entityId: policy.id,
          action: 'closure_policy.version_created',
          newValues: {
            clientId: input.clientId,
            stage: input.stage,
            version: policy.version,
            status: policy.status,
            requirements: input.requirements.map(({ documentType, scope }) => ({
              documentType,
              scope,
            })),
          },
        },
      });
      return tx.closurePolicy.findUniqueOrThrow({
        where: { id: policy.id },
        include: this.relations,
      });
    });
  }

  async activate(principal: AuthenticatedPrincipal, id: string) {
    return this.transition(principal, id, 'ACTIVE');
  }

  async deactivate(principal: AuthenticatedPrincipal, id: string) {
    return this.transition(principal, id, 'RETIRED');
  }

  async approve(principal: AuthenticatedPrincipal, id: string) {
    return this.transition(principal, id, 'APPROVED');
  }

  private transition(
    principal: AuthenticatedPrincipal,
    id: string,
    target: 'APPROVED' | 'ACTIVE' | 'RETIRED',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `CLOSURE_POLICY_ACTIVATION:${principal.organizationId}:${id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const current = await tx.closurePolicy.findFirst({
        where: { id, organizationId: principal.organizationId },
        include: this.relations,
      });
      if (!current) throw new NotFoundException('Closure policy not found');
      if (current.status === target) return current;
      const allowed = {
        DRAFT: ['APPROVED'],
        APPROVED: ['ACTIVE'],
        ACTIVE: ['RETIRED'],
        RETIRED: [],
      } as const;
      if (!(allowed[current.status] as readonly string[]).includes(target))
        throw new ConflictException(
          `Closure policy cannot transition from ${current.status} to ${target}`,
        );
      if (target === 'APPROVED' && current.authoredByUserId === principal.userId)
        throw new ConflictException('Policy author cannot approve the same policy');
      if (target === 'ACTIVE') {
        await tx.closurePolicy.updateMany({
          where: {
            organizationId: principal.organizationId,
            clientId: current.clientId,
            stage: current.stage,
            status: 'ACTIVE',
            id: { not: id },
          },
          data: { status: 'RETIRED', isActive: false },
        });
      }
      const isActive = target === 'ACTIVE';
      const policy = await tx.closurePolicy.update({
        where: { id },
        data: {
          isActive,
          status: target,
          activatedByUserId: isActive ? principal.userId : null,
          activatedAt: isActive ? new Date() : null,
          approvedByUserId: target === 'APPROVED' ? principal.userId : current.approvedByUserId,
          approvedAt: target === 'APPROVED' ? new Date() : current.approvedAt,
        },
        include: this.relations,
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'ClosurePolicy',
          entityId: id,
          action: `closure_policy.${target.toLowerCase()}`,
          oldValues: { status: current.status },
          newValues: {
            status: target,
            isActive,
            activatedAt: policy.activatedAt?.toISOString() ?? null,
          },
        },
      });
      return policy;
    });
  }

  private requireUniqueRequirements(input: SaveClosurePolicyDto) {
    const keys = input.requirements.map(({ documentType, scope }) => `${documentType}:${scope}`);
    if (new Set(keys).size !== keys.length)
      throw new ConflictException('Closure policy contains duplicate requirements');
  }

  private async requireActiveClient(organizationId: string, clientId: string) {
    if (
      !(await this.prisma.client.findFirst({
        where: { id: clientId, organizationId, status: 'ACTIVE' },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Active client not found');
  }

  private readonly relations = {
    client: { select: { id: true, code: true, name: true } },
    requirements: { orderBy: [{ documentType: 'asc' }, { scope: 'asc' }] },
    activatedBy: { select: { id: true, name: true } },
  } satisfies Prisma.ClosurePolicyInclude;
}
