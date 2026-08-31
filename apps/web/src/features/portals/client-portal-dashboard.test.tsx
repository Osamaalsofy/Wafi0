import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientPortalDashboard } from './client-portal-dashboard';

const getControlTower = vi.fn();
vi.mock('../../lib/api-client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  getControlTower: (...args: unknown[]) => getControlTower(...args),
}));
vi.mock('../../i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en' }) }));
vi.mock('../../i18n/localized-surface', () => ({ translateVisibleText: (value: string) => value }));
vi.mock('../control-tower/mission-detail-panel', () => ({ MissionDetailPanel: () => <div>Mission detail opened</div> }));

const response = {
  summary: { totalActive: 1, byStatus: { IN_TRANSIT: 1 }, pageRequiringDocumentAttention: 1, openExceptions: 1, criticalExceptions: 0, delayEvaluation: { available: true, reason: '' } },
  filterOptions: { clients: [], warehouses: [{ id: 'w1', clientId: 'c1', code: 'WH-1', name: 'Main warehouse' }], carriers: [], drivers: [] },
  data: [{
    id: 'm1', missionNo: 'MIS-1001', status: 'IN_TRANSIT', cargoType: null, scheduledLoadingAt: '2026-08-26T08:00:00Z', updatedAt: '2026-08-26T09:00:00Z',
    client: { id: 'c1', code: 'C-1', name: 'Customer' }, warehouse: { id: 'w1', code: 'WH-1', name: 'Main warehouse', address: null, latitude: null, longitude: null },
    carrier: { id: 'ca1', code: 'CAR-1', name: 'Carrier' }, vehicle: null, driver: { id: 'd1', name: 'Driver' },
    route: { id: 'r1', code: 'R-1', name: 'Muscat route', cityRegion: 'Muscat', timeZone: 'Asia/Muscat' },
    stopProgress: { total: 2, pending: 1, arrived: 0, unloading: 0, completed: 1, cancelled: 0 },
    closureReadiness: { applicable: true, stage: 'OPERATIONAL_CLOSURE', policyConfigured: true, ready: false, missing: [{ documentType: 'POD', scope: 'EACH_STOP', missingStopIds: ['s1'] }] },
    openExceptions: [{ id: 'e1', ruleCode: 'STOP_ARRIVAL_DELAY', severity: 'HIGH', status: 'OPEN', isBlocking: false, firstDetectedAt: '2026-08-26T09:00:00Z', lastDetectedAt: '2026-08-26T09:00:00Z', definition: { name: 'Stop arrival delay' }, stop: null }],
    mapStops: [{ id: 's1', sequence: 1, status: 'PENDING', expectedArrival: null, branch: { id: 'b1', code: 'B-1', name: 'Seeb branch', address: null, latitude: null, longitude: null } }],
  }],
  meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
};

describe('ClientPortalDashboard', () => {
  beforeEach(() => getControlTower.mockResolvedValue(response));

  it('shows the executive overview and opens the shipment workspace', async () => {
    render(<ClientPortalDashboard accessToken="token" />);
    expect(await screen.findByRole('heading', { name: 'Your logistics, clearly in view' })).toBeVisible();
    expect(screen.getByText('Stop arrival delay')).toBeVisible();
    expect(screen.getByText('MIS-1001')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Shipments' }));
    expect(screen.getByPlaceholderText('Search mission, route, warehouse…')).toBeVisible();
    expect(screen.getByText('Muscat route')).toBeVisible();
  });
});
