import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getRuleConfigurationOptions, getRuleConfigurations } from '../../lib/api-client';
import { RuleConfigurationWorkspace } from './rule-configuration-workspace';

vi.mock('../../lib/api-client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  getRuleConfigurationOptions: vi.fn(),
  getRuleConfigurations: vi.fn(),
  createRuleConfiguration: vi.fn(),
  getAuditContext: vi.fn().mockResolvedValue([]),
  reevaluateOperationalRules: vi.fn(),
}));

describe('RuleConfigurationWorkspace', () => {
  it('supports contract-scoped SLA configuration and keeps unapproved scopes unavailable', async () => {
    vi.mocked(getRuleConfigurationOptions).mockResolvedValue({
      organization: { id: 'organization-id', name: 'Organization default' },
      definitions: [
        {
          code: 'LOADING_DELAY',
          name: 'Loading delay',
          description: 'Actual loading exceeds the effective threshold.',
          defaultThresholdMinutes: 30,
          defaultQuantityTolerance: null,
          enabledByDefault: true,
        },
      ],
      scopes: {
        clients: [],
        warehouses: [],
        carriers: [],
        contracts: [
          {
            id: 'contract-id',
            code: 'CLIENT-ANNUAL',
            name: 'Client annual contract',
            cadence: 'ANNUAL',
            effectiveTo: null,
          },
        ],
      },
      owners: [],
      unsupportedScopes: ['ROUTE', 'DRIVER'],
    });
    vi.mocked(getRuleConfigurations).mockResolvedValue([]);

    render(<RuleConfigurationWorkspace accessToken="token" onClose={vi.fn()} />);

    expect(await screen.findByRole('option', { name: /Loading delay/ })).toBeVisible();
    expect(screen.getByPlaceholderText('Product default: 30')).toBeVisible();
    expect(screen.getByText(/Route and driver SLA scopes remain unavailable/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Scope type'), { target: { value: 'CONTRACT' } });
    expect(
      screen.getByRole('option', { name: 'Client annual contract · CLIENT-ANNUAL' }),
    ).toBeVisible();
  });
});
