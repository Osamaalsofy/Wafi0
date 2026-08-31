import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../lib/api-client';
import type { MissionDetail } from '../control-tower/types';
import { MissionWorkflowActions } from './mission-workflow-actions';

vi.mock('../auth/session-provider', () => ({
  useSession: () => ({ hasPermission: () => true }),
}));
vi.mock('../../lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/api-client')>();
  return {
    ...original,
    listResource: vi.fn(),
    getAvailableMissionTransitions: vi.fn(),
    getExceptions: vi.fn(),
    transitionMission: vi.fn(),
    recordMissionStopArrival: vi.fn(),
  };
});

const mission: MissionDetail = {
  id: 'mission-1',
  missionNo: 'MSN-001',
  status: 'ASSIGNED',
  cargoType: 'Medical',
  scheduledLoadingAt: null,
  actualLoadingAt: null,
  scheduledDepartureAt: null,
  actualDepartureAt: null,
  notes: null,
  createdAt: '2026-08-12T00:00:00Z',
  updatedAt: '2026-08-12T00:00:00Z',
  client: { id: 'client-1', code: 'C1', name: 'Client One' },
  warehouse: { id: 'warehouse-1', code: 'W1', name: 'Warehouse One' },
  contract: null,
  carrier: null,
  vehicle: null,
  driver: null,
  route: null,
  stops: [
    {
      id: 'stop-1',
      sequence: 1,
      status: 'PENDING',
      expectedArrival: null,
      actualArrival: null,
      unloadingStartedAt: null,
      unloadingCompletedAt: null,
      expectedQty: '10',
      receivedQty: null,
      rejectedQty: null,
      shortageQty: null,
      notes: null,
      branch: { id: 'branch-1', code: 'B1', name: 'Branch One' },
    },
  ],
};

describe('MissionWorkflowActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listResource).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    vi.mocked(api.getAvailableMissionTransitions).mockResolvedValue({
      status: 'ASSIGNED',
      transitions: ['WAITING_FOR_VEHICLE', 'CANCELLED'],
    });
    vi.mocked(api.getExceptions).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    vi.mocked(api.transitionMission).mockResolvedValue({});
    vi.mocked(api.recordMissionStopArrival).mockResolvedValue({});
  });

  it('uses server-provided transitions and invokes stop arrival through the real client contract', async () => {
    const onChanged = vi.fn();
    render(<MissionWorkflowActions accessToken="token" mission={mission} onChanged={onChanged} />);

    await screen.findByRole('option', { name: 'WAITING FOR VEHICLE' });
    expect(screen.queryByRole('button', { name: 'Start unloading' })).not.toBeInTheDocument();
    expect(screen.queryByText('Complete stop')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply transition' }));
    await waitFor(() =>
      expect(api.transitionMission).toHaveBeenCalledWith('token', 'mission-1', {
        toStatus: 'WAITING_FOR_VEHICLE',
        reason: undefined,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Record arrival' }));
    await waitFor(() =>
      expect(api.recordMissionStopArrival).toHaveBeenCalledWith('token', 'stop-1'),
    );
    expect(onChanged).toHaveBeenCalledTimes(2);
  });
});
