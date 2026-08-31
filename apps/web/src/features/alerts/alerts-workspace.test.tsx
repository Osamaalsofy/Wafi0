import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getAlerts } from '../../lib/api-client';
import { AlertsWorkspace } from './alerts-workspace';

vi.mock('../../lib/api-client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  getAlerts: vi.fn(),
  markAlertRead: vi.fn(),
}));

describe('AlertsWorkspace', () => {
  it('shows persisted alert facts and exception navigation', async () => {
    vi.mocked(getAlerts).mockResolvedValue({
      data: [
        {
          id: 'alert-id',
          exceptionId: 'exception-id',
          userId: null,
          channel: 'EMAIL',
          status: 'SENT',
          sentAt: '2026-08-10T08:36:00Z',
          readAt: null,
          escalationDueAt: '2026-08-10T08:45:00Z',
          escalatedAt: '2026-08-10T08:45:00Z',
          createdAt: '2026-08-10T08:31:00Z',
          deliveryAttempts: [
            {
              id: 'attempt-1',
              attemptNo: 1,
              channel: 'EMAIL',
              outcome: 'FAILED',
              attemptedAt: '2026-08-10T08:31:00Z',
              error: 'Temporary failure',
              nextAttemptAt: '2026-08-10T08:36:00Z',
            },
            {
              id: 'attempt-2',
              attemptNo: 2,
              channel: 'EMAIL',
              outcome: 'SENT',
              attemptedAt: '2026-08-10T08:36:00Z',
              error: null,
              nextAttemptAt: null,
            },
          ],
          escalations: [
            {
              id: 'escalation-id',
              escalatedAt: '2026-08-10T08:45:00Z',
              recipient: {
                id: 'manager-id',
                name: 'Fleet Manager',
                email: 'fleet@example.com',
              },
            },
          ],
          exception: {
            id: 'exception-id',
            ruleCode: 'LOADING_DELAY',
            status: 'OPEN',
            severity: 'WARNING',
            isBlocking: false,
            openedAt: '2026-08-10T08:31:00Z',
            lastDetectedAt: '2026-08-10T08:31:00Z',
            delayMinutes: 31,
            actualQuantity: null,
            owner: null,
            mission: { id: 'mission-id', missionNo: 'MSN-001', status: 'LOADING' },
            stop: null,
            definition: { code: 'LOADING_DELAY', name: 'Loading delay' },
          },
        },
      ],
      summary: { unread: 1 },
      meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });

    render(<AlertsWorkspace accessToken="token" onClose={vi.fn()} onOpenException={vi.fn()} />);

    expect(await screen.findByText('Loading delay')).toBeVisible();
    expect(screen.getByText(/31 minute delay/)).toBeVisible();
    expect(screen.getByText('Email delivery · SENT · 2/2 attempts')).toBeVisible();
    expect(screen.getByText('Escalated to Fleet Manager')).toBeVisible();
    expect(screen.getByRole('button', { name: /Audit timeline/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open exception' })).toBeVisible();
  });
});
