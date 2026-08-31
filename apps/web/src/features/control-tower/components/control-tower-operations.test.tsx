import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ControlTowerMission } from '../types';
import { AttentionPanel } from './attention-panel';
import { LiveOperations } from './live-operations';
import { MapLayerControl } from './map-layer-control';

const mission: ControlTowerMission = {
  id: 'mission-1',
  missionNo: 'WAF-10428',
  status: 'IN_TRANSIT',
  cargoType: null,
  scheduledLoadingAt: null,
  updatedAt: '2026-08-14T08:00:00.000Z',
  client: { id: 'client-1', code: 'CLIENT', name: 'Saudi Client' },
  warehouse: { id: 'warehouse-1', code: 'RUH', name: 'Riyadh Hub', address: 'Riyadh', latitude: '24.7136', longitude: '46.6753' },
  carrier: null,
  vehicle: { id: 'vehicle-1', plateNo: '4582 KSA' },
  driver: { id: 'driver-1', name: 'Ahmed' },
  route: { id: 'route-1', code: 'RUH-JED', name: 'Riyadh to Jeddah', cityRegion: 'Riyadh', timeZone: 'Asia/Riyadh' },
  stopProgress: { total: 1, pending: 1, arrived: 0, unloading: 0, completed: 0, cancelled: 0 },
  closureReadiness: { applicable: false },
  openExceptions: [{ id: 'exception-1', ruleCode: 'ARRIVAL_DELAY', severity: 'CRITICAL', status: 'OPEN', isBlocking: true, firstDetectedAt: '2026-08-14T07:00:00.000Z', lastDetectedAt: '2026-08-14T08:00:00.000Z', definition: { name: 'Stop arrival delay' }, stop: { branch: { id: 'branch-1', code: 'JED', name: 'Jeddah Branch' } } }],
  mapStops: [{ id: 'stop-1', sequence: 1, status: 'PENDING', expectedArrival: null, branch: { id: 'branch-1', code: 'JED', name: 'Jeddah Branch', address: 'Jeddah', latitude: '21.5433', longitude: '39.1728' } }],
};

describe('Control Tower operational components', () => {
  afterEach(cleanup);

  it('toggles map layers and exposes future geofences as unavailable', () => {
    const onToggle = vi.fn();
    render(<MapLayerControl arabic={false} visibleLayers={{ locations: true, missions: true, vehicles: true, warehouses: true, routes: false, exceptions: true }} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Routes' }));
    expect(onToggle).toHaveBeenCalledWith('routes');
    expect(screen.getByText(/Geofences/)).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders factual exceptions and opens the selected workflow', () => {
    const onOpen = vi.fn();
    render(<AttentionPanel missions={[mission]} arabic={false} onOpenException={onOpen} />);
    expect(screen.getByText('Stop arrival delay')).toBeVisible();
    expect(screen.getByText(/Jeddah Branch/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /WAF-10428/ }));
    expect(onOpen).toHaveBeenCalledWith('exception-1');
  });

  it('supports exception filtering and empty operational states', () => {
    render(<LiveOperations missions={[mission]} arabic={false} onSelectMission={vi.fn()} onSelectException={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exceptions' }));
    expect(screen.getByText('WAF-10428')).toBeVisible();
    render(<LiveOperations missions={[]} arabic onSelectMission={vi.fn()} onSelectException={vi.fn()} />);
    expect(screen.getByText('لا توجد مهام مطابقة')).toBeVisible();
  });
});
