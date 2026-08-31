import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlTowerApp } from './control-tower-app';
import { SessionProvider } from '../auth/session-provider';
import { AuthenticatedApp } from '../auth/authenticated-app';

vi.mock('next/navigation', () => ({ usePathname: () => '/os/control-tower' }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('maplibre-gl', () => {
  class Map {
    private sources = new globalThis.Map<string, { setData: ReturnType<typeof vi.fn> }>();
    addControl() {}
    addSource(id: string) { this.sources.set(id, { setData: vi.fn() }); }
    addLayer() {}
    getSource(id: string) { return this.sources.get(id); }
    getLayer() { return {}; }
    setLayoutProperty() {}
    getCanvas() { return { style: { cursor: '' } }; }
    flyTo() {}
    on(event: string, layerOrHandler: string | (() => void), handler?: () => void) {
      if (event === 'load') (typeof layerOrHandler === 'function' ? layerOrHandler : handler)?.();
    }
    remove() {}
  }
  return { Map, NavigationControl: class {}, AttributionControl: class {} };
});

describe('ControlTowerApp', () => {
  afterEach(() => vi.restoreAllMocks());

  it('authenticates and renders live Control Tower data', async () => {
    const createObjectUrl = vi.fn(() => 'blob:wafi-document');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid refresh token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: 'access-token', expiresIn: 900 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            userId: 'user-1',
            organizationId: 'organization-1',
            email: 'ops@example.com',
            grants: [
              {
                permission: 'control_tower.read',
                scopeType: 'ORGANIZATION',
                scopeId: 'organization-1',
              },
            ],
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            summary: {
              totalActive: 2,
              byStatus: {
                DRAFT: 0,
                ASSIGNED: 0,
                WAITING_FOR_VEHICLE: 1,
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
              delayEvaluation: { available: false, reason: 'Not configured' },
            },
            filterOptions: {
              clients: [{ id: 'client-1', code: 'CLIENT', name: 'Test Client' }],
              warehouses: [
                {
                  id: 'warehouse-1',
                  clientId: 'client-1',
                  code: 'MCT',
                  name: 'Muscat Warehouse',
                },
              ],
              carriers: [{ id: 'carrier-1', code: 'FAST', name: 'Fast Carrier' }],
            },
            data: [
              {
                id: 'mission-1',
                missionNo: 'MSN-001',
                status: 'IN_TRANSIT',
                cargoType: 'Medical supplies',
                scheduledLoadingAt: '2026-08-10T05:00:00.000Z',
                updatedAt: '2026-08-10T07:00:00.000Z',
                client: { id: 'client-1', code: 'CLIENT', name: 'Test Client' },
                warehouse: { id: 'warehouse-1', code: 'RUH', name: 'Riyadh Warehouse', address: 'Riyadh', latitude: '24.7136', longitude: '46.6753' },
                carrier: { id: 'carrier-1', code: 'FAST', name: 'Fast Carrier' },
                vehicle: { id: 'vehicle-1', plateNo: '1234 AB' },
                driver: { id: 'driver-1', name: 'Test Driver' },
                route: { id: 'route-1', code: 'RUH-JED', name: 'Riyadh to Jeddah', cityRegion: 'Riyadh', timeZone: 'Asia/Riyadh' },
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
                mapStops: [{ id: 'stop-1', sequence: 1, status: 'PENDING', expectedArrival: '2026-08-10T08:00:00.000Z', branch: { id: 'branch-1', code: 'JED', name: 'Jeddah Branch', address: 'Jeddah', latitude: '21.5433', longitude: '39.1728' } }],
              },
            ],
            meta: { page: 1, limit: 25, total: 2, totalPages: 1 },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'mission-1',
            missionNo: 'MSN-001',
            status: 'IN_TRANSIT',
            cargoType: 'Medical supplies',
            scheduledLoadingAt: '2026-08-10T05:00:00.000Z',
            actualLoadingAt: '2026-08-10T05:15:00.000Z',
            scheduledDepartureAt: '2026-08-10T06:00:00.000Z',
            actualDepartureAt: '2026-08-10T06:10:00.000Z',
            notes: null,
            createdAt: '2026-08-10T04:00:00.000Z',
            updatedAt: '2026-08-10T07:00:00.000Z',
            client: { id: 'client-1', code: 'CLIENT', name: 'Test Client' },
            contract: {
              id: 'contract-1',
              code: 'CLIENT-ANNUAL',
              name: 'Client annual contract',
              cadence: 'ANNUAL',
              status: 'ACTIVE',
            },
            route: {
              id: 'route-1',
              code: 'RUH-01',
              name: 'Riyadh distribution route',
              cityRegion: 'Riyadh',
              timeZone: 'Asia/Riyadh',
              status: 'ACTIVE',
            },
            warehouse: { id: 'warehouse-1', code: 'MCT', name: 'Muscat Warehouse' },
            carrier: { id: 'carrier-1', code: 'FAST', name: 'Fast Carrier' },
            vehicle: { id: 'vehicle-1', plateNo: '1234 AB' },
            driver: { id: 'driver-1', name: 'Test Driver' },
            stops: [
              {
                id: 'stop-1',
                sequence: 1,
                status: 'PENDING',
                expectedArrival: '2026-08-10T08:00:00.000Z',
                actualArrival: null,
                unloadingStartedAt: null,
                unloadingCompletedAt: null,
                expectedQty: '10',
                receivedQty: null,
                rejectedQty: null,
                shortageQty: null,
                notes: null,
                branch: { id: 'branch-1', code: 'BR-1', name: 'Branch One' },
              },
            ],
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'event-1',
                stopId: null,
                eventType: 'mission.departed',
                occurredAt: '2026-08-10T06:10:00.000Z',
                source: 'API',
              },
            ],
            meta: { page: 1, limit: 20, total: 21, totalPages: 2 },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'document-1',
                stopId: 'stop-1',
                type: 'WAYBILL',
                originalFileName: 'waybill.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 2048,
                verificationStatus: 'VERIFIED',
                verifiedAt: '2026-08-10T06:00:00.000Z',
                verificationNotes: null,
                createdAt: '2026-08-10T05:30:00.000Z',
                stop: { id: 'stop-1', sequence: 1 },
                uploadedBy: { id: 'user-1', name: 'Operator' },
                verifiedBy: { id: 'user-2', name: 'Supervisor' },
              },
            ],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'event-21',
                stopId: 'stop-1',
                eventType: 'stop.arrived',
                occurredAt: '2026-08-10T08:00:00.000Z',
                source: 'API',
              },
            ],
            meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['document-content'], { type: 'application/pdf' })),
      } as Response)
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
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
              delayEvaluation: { available: false, reason: 'Not configured' },
            },
            filterOptions: {
              clients: [{ id: 'client-1', code: 'CLIENT', name: 'Test Client' }],
              warehouses: [
                {
                  id: 'warehouse-1',
                  clientId: 'client-1',
                  code: 'MCT',
                  name: 'Muscat Warehouse',
                },
              ],
              carriers: [{ id: 'carrier-1', code: 'FAST', name: 'Fast Carrier' }],
            },
            data: [],
            meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
          }),
      } as Response);

    render(
      <SessionProvider>
        <AuthenticatedApp>
          <ControlTowerApp embedded />
        </AuthenticatedApp>
      </SessionProvider>,
    );
    fireEvent.change(await screen.findByLabelText(/organization code/i), {
      target: { value: 'wafi' },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'ops@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in securely/i }));

    expect(await screen.findByRole('heading', { name: 'Control Tower' })).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/auth/refresh');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/auth/login');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ credentials: 'include' });
    expect(screen.getByText('Mission movement')).toBeVisible();
    expect(screen.getByText('MSN-001')).toBeVisible();
    expect(screen.getByLabelText('Saudi Arabia operations map')).toBeVisible();
    expect(screen.queryByText('Attention required')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^open$/i }));
    expect(await screen.findByRole('dialog', { name: 'MSN-001' })).toBeVisible();
    expect(screen.getByText(/Client annual contract · CLIENT-ANNUAL · Annual/)).toBeVisible();
    expect(screen.getByText('Riyadh distribution route · Riyadh')).toBeVisible();
    expect(screen.getByText('Branch One')).toBeVisible();
    expect(screen.getByText('Waybill')).toBeVisible();
    expect(screen.getByText('Mission departed')).toBeVisible();
    expect(screen.getByRole('button', { name: /Audit timeline/ })).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(7));

    fireEvent.click(screen.getByRole('button', { name: 'Next event page' }));
    expect(await screen.findByText('Stop arrived')).toBeVisible();
    expect(fetchMock.mock.calls[7]?.[0]).toContain('/events?page=2&limit=20');

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(9));
    await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce());
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:wafi-document');
    expect(fetchMock.mock.calls[8]?.[0]).toContain('/documents/document-1/content');

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(10));
    expect(fetchMock.mock.calls[9]?.[0]).toContain('clientId=client-1');

    fireEvent.click(screen.getByRole('button', { name: /close mission details/i }));
    fireEvent.click(screen.getByRole('button', { name: /refresh now/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(11));
    expect(screen.getByLabelText('Automatic refresh interval')).toHaveValue('60');
  });
});
