import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getKpiConfigurationOptions, getKpiConfigurations } from '../../lib/api-client';
import { KpiConfigurationWorkspace } from './kpi-configuration-workspace';

vi.mock('../../lib/api-client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  getKpiConfigurationOptions: vi.fn(),
  getKpiConfigurations: vi.fn(),
  createKpiConfiguration: vi.fn(),
  getAuditContext: vi.fn().mockResolvedValue([]),
}));

describe('KpiConfigurationWorkspace', () => {
  it('makes the non-calculating registry boundary explicit', async () => {
    vi.mocked(getKpiConfigurationOptions).mockResolvedValue({
      organization: { id: 'organization-id', name: 'Organization default' },
      definitions: [
        {
          code: 'ON_TIME_LOADING',
          name: 'On-Time Loading',
          description: 'Candidate KPI requiring an approved contract.',
        },
      ],
      scopes: {
        clients: [],
        warehouses: [],
        carriers: [],
        contracts: [
          {
            id: 'contract-id',
            code: 'ANNUAL-1',
            name: 'Annual client contract',
            cadence: 'ANNUAL',
            effectiveTo: null,
          },
        ],
        drivers: [{ id: 'driver-id', carrierId: 'carrier-id', name: 'Approved Driver' }],
      },
      unsupportedScopes: ['ROUTE'],
      calculationAvailable: false,
    });
    vi.mocked(getKpiConfigurations).mockResolvedValue([]);

    render(<KpiConfigurationWorkspace accessToken="token" onClose={vi.fn()} />);

    expect(await screen.findByRole('option', { name: /On-Time Loading/ })).toBeVisible();
    expect(screen.getByText('Calculation disabled')).toBeVisible();
    expect(screen.getByText(/No KPI engine, aggregate, score/)).toBeVisible();
    expect(screen.getByRole('option', { name: 'Contract' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Driver' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('Scope type'), { target: { value: 'DRIVER' } });
    expect(screen.getByRole('option', { name: 'Approved Driver' })).toBeVisible();
    expect(screen.getByLabelText('Target percent')).toHaveValue(90);
    expect(screen.getByLabelText('Calculation frequency')).toHaveValue('DAILY');
  });
});
