import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissionsWorkspace } from './missions-workspace';

vi.mock('../auth/session-provider', () => ({
  useSession: () => ({ hasPermission: () => false }),
}));

describe('MissionsWorkspace', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads and filters the real paginated mission endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'mission-1',
              missionNo: 'MSN-001',
              status: 'IN_TRANSIT',
              cargoType: 'Medical',
              scheduledLoadingAt: '2026-08-12T08:00:00Z',
              createdAt: '2026-08-11T08:00:00Z',
              client: { id: 'client-1', code: 'C1', name: 'Client One' },
              warehouse: { id: 'warehouse-1', code: 'W1', name: 'Warehouse One' },
              carrier: { id: 'carrier-1', code: 'CR1', name: 'Carrier One' },
              route: {
                id: 'route-1',
                code: 'R1',
                name: 'Route One',
                cityRegion: 'Muscat',
                timeZone: 'Asia/Muscat',
              },
            },
          ],
          meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
        }),
    } as Response);

    render(<MissionsWorkspace accessToken="token" />);
    expect(await screen.findByText('MSN-001')).toBeVisible();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/missions?page=1&limit=25');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    });

    fireEvent.change(screen.getByPlaceholderText('Mission number or cargo'), {
      target: { value: 'medical' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toContain('search=medical');
  });
});
