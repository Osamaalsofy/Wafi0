import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';
import { bootstrapAdministratorPermissions } from './bootstrap-permissions.js';

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function bootstrap(): Promise<void> {
  const databaseUrl = requireEnvironment('DATABASE_URL');
  const organizationCode = requireEnvironment('BOOTSTRAP_ORGANIZATION_CODE').toLowerCase();
  const organizationName = requireEnvironment('BOOTSTRAP_ORGANIZATION_NAME');
  const adminEmail = requireEnvironment('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const adminName = requireEnvironment('BOOTSTRAP_ADMIN_NAME');
  const adminPassword = requireEnvironment('BOOTSTRAP_ADMIN_PASSWORD');
  if (adminPassword.length < 12)
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { code: organizationCode },
        create: { code: organizationCode, name: organizationName },
        update: {},
      });
      const permissions = await Promise.all(
        bootstrapAdministratorPermissions.map((code) =>
          tx.permission.upsert({ where: { code }, create: { code }, update: {} }),
        ),
      );
      const role = await tx.role.upsert({
        where: {
          organizationId_code: { organizationId: organization.id, code: 'ORGANIZATION_ADMIN' },
        },
        create: {
          organizationId: organization.id,
          code: 'ORGANIZATION_ADMIN',
          name: 'Organization Administrator',
          permissions: {
            create: permissions.map((permission) => ({ permissionId: permission.id })),
          },
        },
        update: {},
      });
      await Promise.all(
        permissions.map((permission) =>
          tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
            create: { roleId: role.id, permissionId: permission.id },
            update: {},
          }),
        ),
      );
      const existingUser = await tx.user.findUnique({
        where: { organizationId_email: { organizationId: organization.id, email: adminEmail } },
      });
      const admin =
        existingUser ??
        (await tx.user.create({
          data: {
            organizationId: organization.id,
            email: adminEmail,
            name: adminName,
            passwordHash: await hash(adminPassword, 12),
          },
        }));
      await tx.userRole.upsert({
        where: {
          userId_roleId_scopeType_scopeId: {
            userId: admin.id,
            roleId: role.id,
            scopeType: 'ORGANIZATION',
            scopeId: organization.id,
          },
        },
        create: {
          userId: admin.id,
          roleId: role.id,
          scopeType: 'ORGANIZATION',
          scopeId: organization.id,
        },
        update: {},
      });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: admin.id,
          entityType: 'Organization',
          entityId: organization.id,
          action: 'identity.bootstrap_completed',
          newValues: { organizationCode, adminEmail },
        },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrap();
