import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { CreateRoleDto } from './dto/create-role.dto';

const roleInclude = {
  permissions: {
    include: { permission: true },
    orderBy: { permission: { code: 'asc' } },
  },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list(principal: AuthenticatedPrincipal) {
    return this.prisma.role.findMany({
      where: { organizationId: principal.organizationId },
      include: roleInclude,
      orderBy: { code: 'asc' },
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  async create(principal: AuthenticatedPrincipal, input: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: {
        organizationId_code: { organizationId: principal.organizationId, code: input.code },
      },
    });
    if (existing) throw new ConflictException('Role code already exists in this organization');
    const permissions = await this.resolvePermissions(input.permissionCodes);
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          organizationId: principal.organizationId,
          code: input.code,
          name: input.name.trim(),
          description: input.description?.trim(),
          permissions: {
            create: permissions.map((permission) => ({ permissionId: permission.id })),
          },
        },
        include: roleInclude,
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Role',
          entityId: role.id,
          action: 'role.created',
          newValues: { code: role.code, permissionCodes: input.permissionCodes },
        },
      });
      return role;
    });
  }

  async setPermissions(
    principal: AuthenticatedPrincipal,
    roleId: string,
    permissionCodes: string[],
  ) {
    const permissions = await this.resolvePermissions(permissionCodes);
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `ROLE_PERMISSIONS:${principal.organizationId}:${roleId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const role = await tx.role.findFirst({
        where: { id: roleId, organizationId: principal.organizationId },
        include: roleInclude,
      });
      if (!role) throw new NotFoundException('Role not found');
      const oldCodes = role.permissions.map(({ permission }) => permission.code);
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length > 0)
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
        });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'Role',
          entityId: roleId,
          action: 'role.permissions_changed',
          oldValues: { permissionCodes: oldCodes },
          newValues: { permissionCodes },
        },
      });
      return tx.role.findUniqueOrThrow({ where: { id: roleId }, include: roleInclude });
    });
  }

  private async resolvePermissions(codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: uniqueCodes } },
    });
    if (permissions.length !== uniqueCodes.length)
      throw new BadRequestException('One or more permission codes are unknown');
    return permissions;
  }
}
