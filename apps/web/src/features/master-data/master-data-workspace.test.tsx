import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MasterDataWorkspace, type MasterDataConfig } from './master-data-workspace';

vi.mock('../auth/session-provider', () => ({ useSession: () => ({ hasPermission: () => true }) }));

const config: MasterDataConfig = {
  path: '/clients',
  title: 'Clients',
  singular: 'Client',
  eyebrow: 'MASTER DATA',
  description: 'Tenant clients',
  permission: 'client',
  fields: [
    { key: 'code', label: 'Client code', required: true },
    { key: 'name', label: 'Client name', required: true },
  ],
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
  ],
};

describe('MasterDataWorkspace', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('lists and creates records through the configured tenant endpoints', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'client-1',
                name: 'Client One',
                code: 'C1',
                status: 'ACTIVE',
                createdAt: '2026-08-12T00:00:00Z',
              },
            ],
            meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'client-2' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ data: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } }),
      } as Response);
    render(<MasterDataWorkspace accessToken="token" config={config} />);
    expect(await screen.findByText('Client One')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Client code'), { target: { value: 'C2' } });
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Client Two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/clients');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ code: 'C2', name: 'Client Two' }),
    });
  });

  it('filters governorates after selecting a Saudi region', async () => {
    const geographyConfig: MasterDataConfig = {
      ...config,
      fields: [
        { key: 'regionId', label: 'Saudi region', optionsPath: '/regions', submit: false },
        { key: 'governorateId', label: 'Governorate', optionsPath: '/governorates', dependsOn: { fieldKey: 'regionId', optionRelationKey: 'region' } },
      ],
    };
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 'riyadh-region', name: 'Riyadh Region', code: 'SA-RIY', status: 'ACTIVE' }, { id: 'makkah-region', name: 'Makkah Region', code: 'SA-MAK', status: 'ACTIVE' }], meta: { page: 1, limit: 2, total: 2, totalPages: 1 } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 'riyadh', name: 'Riyadh', code: 'SA-RIY-RIYADH', status: 'ACTIVE', region: { id: 'riyadh-region' } }, { id: 'jeddah', name: 'Jeddah', code: 'SA-MAK-JEDDAH', status: 'ACTIVE', region: { id: 'makkah-region' } }], meta: { page: 1, limit: 100, total: 2, totalPages: 1 } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } }) } as Response);
    render(<MasterDataWorkspace accessToken="token" config={geographyConfig} />);
    const governorate = await screen.findByLabelText('Governorate');
    expect(governorate).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Saudi region'), { target: { value: 'riyadh-region' } });
    expect(governorate).toBeEnabled();
    expect(screen.getByRole('option', { name: /^Riyadh ·/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Jeddah/ })).not.toBeInTheDocument();
  });
});
