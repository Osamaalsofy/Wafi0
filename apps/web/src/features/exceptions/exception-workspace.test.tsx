import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getException, getExceptions } from '../../lib/api-client';
import { ExceptionWorkspace } from './exception-workspace';

vi.mock('../../lib/api-client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  getExceptions: vi.fn(),
  getException: vi.fn(),
  assignException: vi.fn(),
  changeExceptionSeverity: vi.fn(),
  resolveException: vi.fn(),
  addExceptionRootCause: vi.fn(),
  addExceptionDecision: vi.fn(),
  attachExceptionEvidence: vi.fn(),
  addCorrectiveAction: vi.fn(),
  completeCorrectiveAction: vi.fn(),
  getAuditContext: vi.fn().mockResolvedValue([]),
  getCollection: vi.fn().mockResolvedValue([]),
  getDocuments: vi
    .fn()
    .mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
  getUsers: vi.fn().mockResolvedValue([]),
}));
vi.mock('../auth/session-provider', () => ({ useSession: () => ({ hasPermission: () => true }) }));

describe('ExceptionWorkspace', () => {
  it('renders persisted route-deviation recovery facts without deriving missing values', async () => {
    vi.mocked(getExceptions).mockResolvedValue({
      data: [
        {
          id: 'exception-id',
          ruleCode: 'ROUTE_DEVIATION',
          status: 'RESOLVED',
          severity: null,
          isBlocking: false,
          openedAt: '2026-08-10T08:31:00Z',
          lastDetectedAt: '2026-08-10T08:31:00Z',
          delayMinutes: 8,
          actualQuantity: null,
          owner: null,
          mission: { id: 'mission-id', missionNo: 'MSN-001', status: 'IN_TRANSIT' },
          stop: null,
          definition: { code: 'ROUTE_DEVIATION', name: 'Route deviation' },
        },
      ],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    vi.mocked(getException).mockResolvedValue({
      id: 'exception-id',
      ruleCode: 'ROUTE_DEVIATION',
      status: 'RESOLVED',
      severity: null,
      isBlocking: false,
      openedAt: '2026-08-10T08:31:00Z',
      lastDetectedAt: '2026-08-10T08:31:00Z',
      delayMinutes: 8,
      actualQuantity: null,
      toleranceQuantity: null,
      owner: null,
      mission: { id: 'mission-id', missionNo: 'MSN-001', status: 'IN_TRANSIT' },
      stop: null,
      definition: { code: 'ROUTE_DEVIATION', name: 'Route deviation' },
      clientId: 'client-id',
      warehouseId: 'warehouse-id',
      carrierId: 'carrier-id',
      routeId: 'route-id',
      vehicleId: 'vehicle-id',
      driverId: 'driver-id',
      scheduledAt: null,
      actualAt: '2026-08-10T10:08:00Z',
      resolvedAt: '2026-08-10T10:08:00Z',
      context: {
        deviationStartedAt: '2026-08-10T10:00:00Z',
        returnedToRouteAt: '2026-08-10T10:08:00Z',
        durationMinutes: 8,
      },
      resolutionNotes: 'Driver returned to expected route',
      affectedStops: [],
      evidence: [],
      rootCauses: [],
      decisions: [],
    });

    render(
      <ExceptionWorkspace
        accessToken="token"
        initialExceptionId="exception-id"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Route deviation' })).toBeVisible();
    expect(screen.getByText('route-id')).toBeVisible();
    expect(screen.getByText('8 min')).toBeVisible();
    expect(screen.getByText('Deviation started')).toBeVisible();
    expect(screen.getByText('Returned to route')).toBeVisible();
    expect(screen.getByText(/Driver returned to expected route/)).toBeVisible();
    expect(screen.getByText('Operational warning')).toBeVisible();
    expect(screen.getByText('Unassigned')).toBeVisible();
    await waitFor(() =>
      expect(getException).toHaveBeenCalledWith('token', 'exception-id', expect.any(AbortSignal)),
    );
  });
});
