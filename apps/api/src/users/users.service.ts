import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import type { CreateUserDto } from './dto/create-user.dto';
import type { CreateClientPortalUserDto } from './dto/create-client-portal-user.dto';
import type { CreateDriverPortalUserDto } from './dto/create-driver-portal-user.dto';

const CLIENT_PORTAL_PERMISSIONS = [
  'control_tower.read',
  'mission.read',
  'document.read',
  'support.read',
] as const;
const DRIVER_PORTAL_PERMISSIONS = ['driver_portal.read'] as const;

const userSelection = {
  id: true,
  organizationId: true,
  email: true,
  name: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  driver: { select: { id: true, name: true, carrierId: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(principal: AuthenticatedPrincipal) {
    return this.prisma.user.findMany({
      where: { organizationId: principal.organizationId },
      select: userSelection,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async create(principal: AuthenticatedPrincipal, input: CreateUserDto) {
    const email = input.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({
      where: { organizationId_email: { organizationId: principal.organizationId, email } },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException('A user with this email already exists in the organization');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: principal.organizationId,
          name: input.name.trim(),
          email,
          passwordHash: await hash(input.password, 12),
        },
        select: userSelection,
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'User',
          entityId: user.id,
          action: 'user.created',
          newValues: { email: user.email, name: user.name, status: user.status },
        },
      });
      return user;
    });
  }

  async createClientPortalUser(
    principal: AuthenticatedPrincipal,
    input: CreateClientPortalUserDto,
  ) {
    const email = input.email.toLowerCase();
    const [client, existing] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: input.clientId, organizationId: principal.organizationId, status: 'ACTIVE' },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.user.findUnique({
        where: { organizationId_email: { organizationId: principal.organizationId, email } },
        select: { id: true },
      }),
    ]);
    if (!client) throw new NotFoundException('Active client not found');
    if (existing)
      throw new ConflictException('A user with this email already exists in the organization');

    return this.prisma.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({
        where: { code: { in: [...CLIENT_PORTAL_PERMISSIONS] } },
      });
      if (permissions.length !== CLIENT_PORTAL_PERMISSIONS.length)
        throw new ConflictException('Client portal permissions are not provisioned');

      const role = await tx.role.upsert({
        where: {
          organizationId_code: {
            organizationId: principal.organizationId,
            code: 'CLIENT_PORTAL_USER',
          },
        },
        create: {
          organizationId: principal.organizationId,
          code: 'CLIENT_PORTAL_USER',
          name: 'Client Portal User',
          description: 'Read-only access to one client portal',
        },
        update: {},
      });
      await Promise.all(permissions.map((permission) => tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      })));
      const user = await tx.user.create({
        data: {
          organizationId: principal.organizationId,
          name: input.name.trim(),
          email,
          passwordHash: await hash(input.password, 12),
        },
        select: userSelection,
      });
      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id, scopeType: 'CLIENT', scopeId: client.id },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'User',
          entityId: user.id,
          action: 'client_portal.user_created',
          newValues: { email: user.email, clientId: client.id, clientCode: client.code },
        },
      });
      return { ...user, client };
    });
  }

  async createDriverPortalUser(
    principal: AuthenticatedPrincipal,
    input: CreateDriverPortalUserDto,
  ) {
    const email = input.email.toLowerCase();
    const [driver, existing] = await Promise.all([
      this.prisma.driver.findFirst({
        where: { id: input.driverId, organizationId: principal.organizationId, status: 'ACTIVE' },
        select: { id: true, name: true, userId: true, carrier: { select: { name: true } } },
      }),
      this.prisma.user.findUnique({
        where: { organizationId_email: { organizationId: principal.organizationId, email } },
        select: { id: true },
      }),
    ]);
    if (!driver) throw new NotFoundException('Active driver not found');
    if (driver.userId) throw new ConflictException('Driver is already linked to another user');
    if (existing) throw new ConflictException('A user with this email already exists in the organization');

    return this.prisma.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({
        where: { code: { in: [...DRIVER_PORTAL_PERMISSIONS] } },
      });
      if (permissions.length !== DRIVER_PORTAL_PERMISSIONS.length)
        throw new ConflictException('Driver portal permissions are not provisioned');
      const role = await tx.role.upsert({
        where: { organizationId_code: { organizationId: principal.organizationId, code: 'DRIVER_PORTAL_USER' } },
        create: {
          organizationId: principal.organizationId,
          code: 'DRIVER_PORTAL_USER',
          name: 'Driver Portal User',
          description: 'Access restricted to the linked driver assignments',
        },
        update: {},
      });
      await Promise.all(permissions.map((permission) => tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      })));
      const user = await tx.user.create({
        data: { organizationId: principal.organizationId, name: input.name.trim(), email, passwordHash: await hash(input.password, 12) },
        select: userSelection,
      });
      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id, scopeType: 'ORGANIZATION', scopeId: principal.organizationId },
      });
      await tx.driver.update({ where: { id: driver.id }, data: { userId: user.id } });
      await tx.auditLog.create({
        data: { organizationId: principal.organizationId, actorUserId: principal.userId, entityType: 'User', entityId: user.id, action: 'driver_portal.user_created', newValues: { email: user.email, driverId: driver.id } },
      });
      return { ...user, driver: { id: driver.id, name: driver.name, carrier: driver.carrier } };
    });
  }

  async updateStatus(
    principal: AuthenticatedPrincipal,
    userId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ) {
    if (userId === principal.userId && status === 'INACTIVE')
      throw new ForbiddenException('Users cannot deactivate their own account');
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `USER_STATUS:${principal.organizationId}:${userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const user = await tx.user.findFirst({
        where: { id: userId, organizationId: principal.organizationId },
        select: userSelection,
      });
      if (!user) throw new NotFoundException('User not found');
      if (user.status === status) return user;

      const changed = await tx.user.updateMany({
        where: {
          id: userId,
          organizationId: principal.organizationId,
          status: user.status,
        },
        data: { status },
      });
      if (changed.count !== 1) {
        const latest = await tx.user.findFirst({
          where: { id: userId, organizationId: principal.organizationId },
          select: userSelection,
        });
        if (latest?.status === status) return latest;
        throw new ConflictException('User status changed concurrently; reload and retry');
      }

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: userSelection,
      });
      if (status === 'INACTIVE')
        await tx.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'User',
          entityId: userId,
          action: 'user.status_changed',
          oldValues: { status: user.status },
          newValues: { status },
        },
      });
      return updated;
    });
  }

  async assignOrganizationRole(principal: AuthenticatedPrincipal, userId: string, roleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `USER_ROLE:${principal.organizationId}:${userId}:${roleId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const user = await tx.user.findFirst({
        where: { id: userId, organizationId: principal.organizationId },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('User not found');
      const role = await tx.role.findFirst({
        where: { id: roleId, organizationId: principal.organizationId },
      });
      if (!role) throw new NotFoundException('Role not found');

      const existing = await tx.userRole.findUnique({
        where: {
          userId_roleId_scopeType_scopeId: {
            userId,
            roleId,
            scopeType: 'ORGANIZATION',
            scopeId: principal.organizationId,
          },
        },
      });
      if (existing) return existing;

      const assignment = await tx.userRole.create({
        data: { userId, roleId, scopeType: 'ORGANIZATION', scopeId: principal.organizationId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'User',
          entityId: userId,
          action: 'user.role_assigned',
          newValues: {
            roleId,
            roleCode: role.code,
            scopeType: 'ORGANIZATION',
            scopeId: principal.organizationId,
          },
        },
      });
      return assignment;
    });
  }

  async linkDriver(principal: AuthenticatedPrincipal, userId: string, driverId: string | null, nationalId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, organizationId: principal.organizationId },
        select: { id: true, driver: { select: { id: true } } },
      });
      if (!user) throw new NotFoundException('User not found');
      if (!driverId && nationalId) {
        const matched = await tx.driver.findFirst({ where: { organizationId: principal.organizationId, nationalId, status: 'ACTIVE' }, select: { id: true } });
        if (!matched) throw new NotFoundException('Active driver with this National ID not found');
        driverId = matched.id;
      }
      if (driverId) {
        const driver = await tx.driver.findFirst({
          where: { id: driverId, organizationId: principal.organizationId, status: 'ACTIVE' },
          select: { id: true, userId: true },
        });
        if (!driver) throw new NotFoundException('Active driver not found');
        if (driver.userId && driver.userId !== userId)
          throw new ConflictException('Driver is already linked to another user');
      }
      await tx.driver.updateMany({
        where: { organizationId: principal.organizationId, userId },
        data: { userId: null },
      });
      if (driverId)
        await tx.driver.update({ where: { id: driverId }, data: { userId } });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'User',
          entityId: userId,
          action: 'user.driver_link_changed',
          oldValues: { driverId: user.driver?.id ?? null },
          newValues: { driverId },
        },
      });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelection });
    });
  }

  async changePassword(
    principal: AuthenticatedPrincipal,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const lockKey = `USER_PASSWORD:${principal.organizationId}:${principal.userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const user = await tx.user.findFirst({
        where: {
          id: principal.userId,
          organizationId: principal.organizationId,
          status: 'ACTIVE',
        },
      });
      if (!user || !(await compare(currentPassword, user.passwordHash))) {
        throw new ForbiddenException('Current password is incorrect');
      }
      if (await compare(newPassword, user.passwordHash)) {
        throw new ConflictException('New password must differ from the current password');
      }
      const passwordHash = await hash(newPassword, 12);
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: principal.organizationId,
          actorUserId: principal.userId,
          entityType: 'User',
          entityId: user.id,
          action: 'user.password_changed',
        },
      });
    });
  }

  private async findInOrganization(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: userSelection,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
