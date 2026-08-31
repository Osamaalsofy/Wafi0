import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportsWorkspace } from './reports-workspace';

describe('ReportsWorkspace', () => {
  afterEach(() => vi.restoreAllMocks());
  it('renders the defined daily-loading report from its real endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          summary: { total: 1, openLoadingDelays: 0, incompleteDataConditions: 0 },
          data: [
            {
              id: 'mission-1',
              missionNo: 'M-001',
              status: 'LOADING',
              scheduledLoadingAt: '2026-08-12T08:00:00Z',
              client: { name: 'Client' },
              warehouse: { name: 'Warehouse' },
              carrier: null,
              openExceptions: [],
              stopProgress: { completed: 0, total: 1 },
            },
          ],
          meta: { page: 1, totalPages: 1 },
        }),
    } as Response);
    render(<ReportsWorkspace accessToken="token" />);
    expect(await screen.findByText('M-001')).toBeVisible();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/daily-loading?');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('from=');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    });
  });
});
