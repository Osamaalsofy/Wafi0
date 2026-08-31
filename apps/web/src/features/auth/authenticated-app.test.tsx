import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedApp } from './authenticated-app';
import { SessionProvider } from './session-provider';

const navigation = vi.hoisted(() => ({ pathname: '/os/control-tower' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('AuthenticatedApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    navigation.pathname = '/os/control-tower';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('restores the cookie session, loads the real principal, and filters navigation by grants', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ accessToken: 'token', expiresIn: 900 }))
      .mockResolvedValueOnce(
        response({
          userId: 'user-1',
          organizationId: 'tenant-123456',
          email: 'operator@example.com',
          grants: [
            {
              permission: 'control_tower.read',
              scopeType: 'ORGANIZATION',
              scopeId: 'tenant-123456',
            },
          ],
        }),
      );

    render(
      <SessionProvider>
        <AuthenticatedApp>
          <h1>Live operations</h1>
        </AuthenticatedApp>
      </SessionProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Live operations' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Control Tower' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Exceptions' })).not.toBeInTheDocument();
    expect(screen.getAllByText('operator@example.com').length).toBeGreaterThan(0);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('renders a forbidden state when the current route permission is absent', async () => {
    navigation.pathname = '/rules';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ accessToken: 'token', expiresIn: 900 }))
      .mockResolvedValueOnce(
        response({
          userId: 'user-1',
          organizationId: 'tenant-1',
          email: 'operator@example.com',
          grants: [
            { permission: 'control_tower.read', scopeType: 'ORGANIZATION', scopeId: 'tenant-1' },
          ],
        }),
      );

    render(
      <SessionProvider>
        <AuthenticatedApp>
          <h1>Rules</h1>
        </AuthenticatedApp>
      </SessionProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Access forbidden');
    expect(screen.queryByRole('heading', { name: 'Rules' })).not.toBeInTheDocument();
  });

  it('switches the shell to Arabic RTL structure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      response({ message: 'Invalid refresh token' }, 401),
    );

    render(
      <SessionProvider>
        <AuthenticatedApp>
          <span />
        </AuthenticatedApp>
      </SessionProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'العربية' }));
    expect(document.documentElement).toHaveAttribute('lang', 'ar-SA');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول إلى برج المراقبة' })).toBeVisible();
  });
});
