import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissionCreateForm } from './mission-create-form';

describe('MissionCreateForm', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a mission using selected backend entities instead of raw identifiers', async () => {
    const onCreated = vi.fn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((request, init) => {
      const url = String(request);
      const page = (data: unknown[]) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data, meta: { page: 1, limit: 100, total: data.length } }),
        } as Response);
      if (url.includes('/clients?'))
        return page([{ id: 'client-1', code: 'C1', name: 'Client One', status: 'ACTIVE' }]);
      if (url.includes('/warehouses?'))
        return page([
          {
            id: 'warehouse-1',
            clientId: 'client-1',
            code: 'W1',
            name: 'Warehouse One',
            status: 'ACTIVE',
          },
        ]);
      if (url.includes('/contracts?')) return page([]);
      if (url.includes('/routes?')) return page([]);
      if (url.endsWith('/missions') && init?.method === 'POST')
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 'mission-new' }),
        } as Response);
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<MissionCreateForm accessToken="token" onCreated={onCreated} onCancel={vi.fn()} />);
    await screen.findByRole('option', { name: 'Client One · C1' });
    fireEvent.change(screen.getByLabelText('Mission number'), { target: { value: 'MSN-200' } });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Warehouse'), { target: { value: 'warehouse-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create mission' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('mission-new'));
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/missions') && init?.method === 'POST',
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      missionNo: 'MSN-200',
      clientId: 'client-1',
      warehouseId: 'warehouse-1',
    });
  });
});
