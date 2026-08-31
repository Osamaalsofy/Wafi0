import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentsWorkspace } from './documents-workspace';

vi.mock('../auth/session-provider', () => ({
  useSession: () => ({
    hasPermission: (permission: string) =>
      ['document.upload', 'document.verify'].includes(permission),
  }),
}));

describe('DocumentsWorkspace', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads tenant documents and exposes only API-backed document actions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'document-1',
              missionId: 'mission-1',
              stopId: null,
              type: 'POD',
              originalFileName: 'proof.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 2048,
              verificationStatus: 'PENDING',
              verificationNotes: null,
              createdAt: '2026-08-12T08:00:00Z',
              mission: { id: 'mission-1', missionNo: 'MSN-001' },
              stop: null,
              uploadedBy: { id: 'user-1', name: 'Operator' },
              verifiedBy: null,
            },
          ],
          meta: { page: 1, limit: 25, total: 1, totalPages: 1 },
        }),
    } as Response);

    render(<DocumentsWorkspace accessToken="token" />);

    expect(await screen.findByText('proof.pdf')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Upload evidence' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeVisible();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/documents?page=1&limit=25');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    });
  });
});
