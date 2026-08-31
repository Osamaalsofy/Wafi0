import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getAuditContext } from '../../lib/api-client';
import { AuditTimeline } from './audit-timeline';

vi.mock('../../lib/api-client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  getAuditContext: vi.fn(),
}));

describe('AuditTimeline', () => {
  it('renders the actor, action, timestamp, and changed context', async () => {
    vi.mocked(getAuditContext).mockResolvedValue([
      {
        id: 'audit-id',
        actorUserId: 'user-id',
        entityType: 'OperationalException',
        entityId: 'exception-id',
        action: 'exception.owner_changed',
        oldValues: null,
        newValues: { newOwnerUserId: 'owner-id' },
        requestId: 'request-id',
        ipAddress: null,
        createdAt: '2026-08-10T10:00:00Z',
        actor: { id: 'user-id', name: 'Operations Manager', email: 'manager@example.com' },
      },
    ]);

    render(
      <AuditTimeline
        accessToken="token"
        contextType="EXCEPTION"
        contextId="exception-id"
        initiallyOpen
      />,
    );

    expect(await screen.findByText('exception · owner changed')).toBeVisible();
    expect(screen.getByText(/Operations Manager/)).toBeVisible();
    expect(screen.getByText(/newOwnerUserId: owner-id/)).toBeVisible();
  });
});
