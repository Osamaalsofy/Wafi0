import { expect, test, type Page } from '@playwright/test';

const grants = [
  'control_tower.read',
  'mission.read',
  'document.read',
  'exception.read',
  'daily_loading.read',
  'kpi.read',
  'contract.read',
  'audit.read',
].map((permission) => ({ permission, scopeType: 'ORGANIZATION', scopeId: 'organization-1' }));

async function mockSession(page: Page) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  );
  await page.route('**/auth/login', (route) =>
    route.fulfill({ json: { accessToken: 'browser-token', expiresIn: 900 } }),
  );
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      json: {
        userId: 'user-1',
        organizationId: 'organization-1',
        email: 'ops@example.com',
        grants,
      },
    }),
  );
}

async function login(page: Page) {
  await page.goto('/control-tower');
  await page.getByLabel('Organization code').fill('wafi');
  await page.getByLabel('Work email').fill('ops@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
}

test('rejects invalid credentials without exposing operational pages', async ({ page }) => {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  );
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 401, json: { message: 'Invalid credentials' } }),
  );
  await page.goto('/control-tower');
  await page.getByLabel('Organization code').fill('wafi');
  await page.getByLabel('Work email').fill('wrong@example.com');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('signs in, loads tenant operations and drills into a mission', async ({ page }) => {
  await mockSession(page);
  await page.route(/\/api\/v1\/control-tower(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        summary: {
          totalActive: 1,
          byStatus: {
            DRAFT: 0,
            ASSIGNED: 0,
            WAITING_FOR_VEHICLE: 0,
            VEHICLE_ARRIVED: 0,
            LOADING: 0,
            LOADED: 0,
            DEPARTED: 0,
            IN_TRANSIT: 1,
            AT_STOP: 0,
            DELIVERING: 0,
            DELIVERED: 0,
            OPERATIONALLY_CLOSED: 0,
            ACCOUNTING_READY: 0,
            CLOSED: 0,
            CANCELLED: 0,
          },
          pageRequiringDocumentAttention: 0,
          openExceptions: 0,
          criticalExceptions: 0,
          delayEvaluation: { available: true },
        },
        filterOptions: { clients: [], warehouses: [], carriers: [] },
        data: [
          {
            id: 'mission-1',
            missionNo: 'MSN-001',
            status: 'IN_TRANSIT',
            cargoType: 'Medical supplies',
            scheduledLoadingAt: '2026-08-10T05:00:00.000Z',
            updatedAt: '2026-08-10T07:00:00.000Z',
            client: { id: 'client-1', code: 'C1', name: 'Client One' },
            warehouse: { id: 'warehouse-1', code: 'W1', name: 'Main Warehouse' },
            carrier: null,
            vehicle: null,
            driver: null,
            stopProgress: {
              total: 1,
              pending: 1,
              arrived: 0,
              unloading: 0,
              completed: 0,
              cancelled: 0,
            },
            closureReadiness: { applicable: false },
            openExceptions: [],
          },
        ],
        meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
      },
    }),
  );
  await page.route('**/missions/mission-1', (route) =>
    route.fulfill({
      json: {
        id: 'mission-1',
        missionNo: 'MSN-001',
        status: 'IN_TRANSIT',
        cargoType: 'Medical supplies',
        scheduledLoadingAt: null,
        actualLoadingAt: null,
        scheduledDepartureAt: null,
        actualDepartureAt: null,
        notes: null,
        createdAt: '2026-08-10T04:00:00Z',
        updatedAt: '2026-08-10T07:00:00Z',
        client: { id: 'client-1', code: 'C1', name: 'Client One' },
        contract: null,
        route: null,
        warehouse: { id: 'warehouse-1', code: 'W1', name: 'Main Warehouse' },
        carrier: null,
        vehicle: null,
        driver: null,
        stops: [],
      },
    }),
  );
  await page.route('**/missions/mission-1/events**', (route) =>
    route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } }),
  );
  await page.route('**/documents?missionId=mission-1**', (route) =>
    route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } }),
  );
  await login(page);
  await expect(page.getByText('MSN-001')).toBeVisible();
  await page.getByRole('button', { name: 'View details' }).click();
  await expect(page.getByRole('dialog', { name: 'MSN-001' })).toBeVisible();
});

test('runs a real-data report and downloads XLSX', async ({ page }) => {
  await mockSession(page);
  await page.route('**/daily-loading**', (route) =>
    route.fulfill({
      json: {
        summary: { total: 0, openLoadingDelays: 0, incompleteDataConditions: 0 },
        data: [],
        meta: { page: 1, totalPages: 0 },
      },
    }),
  );
  await page.route('**/reports/mission-performance**', (route) =>
    route.fulfill({
      json: {
        type: 'mission-performance',
        summary: { rows: 1 },
        rows: [
          {
            id: 'mission-1',
            mission: 'MSN-001',
            status: 'CLOSED',
            completedStops: 2,
            totalStops: 2,
          },
        ],
      },
    }),
  );
  await page.goto('/reports');
  await page.getByLabel('Organization code').fill('wafi');
  await page.getByLabel('Work email').fill('ops@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page.getByLabel('Report type').selectOption('mission-performance');
  await expect(page.getByText('MSN-001')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'XLSX' }).click();
  await expect((await download).suggestedFilename()).toMatch(/^wafi-mission-performance-.*\.xlsx$/);
});
