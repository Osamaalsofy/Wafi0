import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Closure policy authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let otherOrganizationId: string;
  let clientId: string;
  let otherClientId: string;
  let administratorToken: string;
  let approverToken: string;
  let viewerToken: string;
  const password = 'Acceptance-password-123';

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error('E2E tests require DATABASE_URL to reference a database ending in _test');
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = randomUUID().slice(0, 8);
    const organization = await prisma.organization.create({
      data: { code: `e2e-${suffix}`, name: 'E2E Organization' },
    });
    const otherOrganization = await prisma.organization.create({
      data: { code: `e2e-other-${suffix}`, name: 'Other E2E Organization' },
    });
    organizationId = organization.id;
    otherOrganizationId = otherOrganization.id;
    const client = await prisma.client.create({
      data: { organizationId, code: 'CLIENT', name: 'E2E Client' },
    });
    const otherClient = await prisma.client.create({
      data: { organizationId: otherOrganizationId, code: 'OTHER', name: 'Other Client' },
    });
    clientId = client.id;
    otherClientId = otherClient.id;

    const [readPermission, managePermission, controlTowerPermission] = await Promise.all([
      prisma.permission.upsert({
        where: { code: 'closure_policy.read' },
        create: { code: 'closure_policy.read' },
        update: {},
      }),
      prisma.permission.upsert({
        where: { code: 'closure_policy.manage' },
        create: { code: 'closure_policy.manage' },
        update: {},
      }),
      prisma.permission.upsert({
        where: { code: 'control_tower.read' },
        create: { code: 'control_tower.read' },
        update: {},
      }),
    ]);
    const adminRole = await prisma.role.create({
      data: {
        organizationId,
        code: 'CLOSURE_ADMIN',
        name: 'Closure Administrator',
        permissions: {
          create: [readPermission, managePermission, controlTowerPermission].map(({ id }) => ({
            permissionId: id,
          })),
        },
      },
    });
    const viewerRole = await prisma.role.create({
      data: {
        organizationId,
        code: 'CLOSURE_VIEWER',
        name: 'Closure Viewer',
        permissions: { create: { permissionId: readPermission.id } },
      },
    });
    const passwordHash = await hash(password, 4);
    const administrator = await prisma.user.create({
      data: {
        organizationId,
        email: `admin-${suffix}@example.com`,
        name: 'Closure Admin',
        passwordHash,
        roleAssignments: {
          create: {
            roleId: adminRole.id,
            scopeType: 'ORGANIZATION',
            scopeId: organizationId,
          },
        },
      },
    });
    const viewer = await prisma.user.create({
      data: {
        organizationId,
        email: `viewer-${suffix}@example.com`,
        name: 'Closure Viewer',
        passwordHash,
        roleAssignments: {
          create: {
            roleId: viewerRole.id,
            scopeType: 'ORGANIZATION',
            scopeId: organizationId,
          },
        },
      },
    });
    const approver = await prisma.user.create({
      data: {
        organizationId,
        email: `approver-${suffix}@example.com`,
        name: 'Closure Approver',
        passwordHash,
        roleAssignments: {
          create: {
            roleId: adminRole.id,
            scopeType: 'ORGANIZATION',
            scopeId: organizationId,
          },
        },
      },
    });
    administratorToken = await login(organization.code, administrator.email);
    approverToken = await login(organization.code, approver.email);
    viewerToken = await login(organization.code, viewer.email);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.refreshSession.deleteMany({ where: { user: { organizationId } } });
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.closureDocumentRequirement.deleteMany({
      where: { policy: { organizationId } },
    });
    await prisma.closurePolicy.deleteMany({ where: { organizationId } });
    await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
    await prisma.user.deleteMany({ where: { organizationId } });
    await prisma.rolePermission.deleteMany({ where: { role: { organizationId } } });
    await prisma.role.deleteMany({ where: { organizationId } });
    await prisma.client.deleteMany({
      where: { organizationId: { in: [organizationId, otherOrganizationId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [organizationId, otherOrganizationId] } },
    });
    await app.close();
  });

  function server() {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  async function login(organizationCode: string, email: string) {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .send({ organizationCode, email, password })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  it('rejects unauthenticated policy access', () =>
    request(server()).get('/api/v1/closure-policies').expect(401));

  it('allows read-only users to list but not mutate policies', async () => {
    await request(server())
      .get('/api/v1/closure-policies')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    await request(server())
      .put('/api/v1/closure-policies')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ clientId, stage: 'OPERATIONAL_CLOSURE', requirements: [] })
      .expect(403);
  });

  it('allows authorized policy creation and activation', async () => {
    const created = await request(server())
      .put('/api/v1/closure-policies')
      .set('Authorization', `Bearer ${administratorToken}`)
      .send({
        clientId,
        stage: 'OPERATIONAL_CLOSURE',
        requirements: [{ documentType: 'POD', scope: 'EACH_STOP' }],
      })
      .expect(200);
    const policyId = (created.body as { id: string }).id;
    await request(server())
      .post(`/api/v1/closure-policies/${policyId}/approve`)
      .set('Authorization', `Bearer ${approverToken}`)
      .expect(201);
    await request(server())
      .post(`/api/v1/closure-policies/${policyId}/activate`)
      .set('Authorization', `Bearer ${administratorToken}`)
      .expect(201);
  });

  it('does not allow configuring another organization client', () =>
    request(server())
      .put('/api/v1/closure-policies')
      .set('Authorization', `Bearer ${administratorToken}`)
      .send({ clientId: otherClientId, stage: 'ACCOUNTING_READINESS', requirements: [] })
      .expect(404));

  it('enforces Control Tower authentication and permission', async () => {
    await request(server()).get('/api/v1/control-tower').expect(401);
    await request(server())
      .get('/api/v1/control-tower')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
    const response = await request(server())
      .get('/api/v1/control-tower')
      .set('Authorization', `Bearer ${administratorToken}`)
      .expect(200);
    expect(response.body).toMatchObject({
      summary: { totalActive: 0 },
      data: [],
      meta: { total: 0 },
    });
  });
});
