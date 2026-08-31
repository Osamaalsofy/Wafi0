'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LoginPanel } from './login-panel';
import { useSession } from './session-provider';
import { I18nProvider, useI18n } from '../../i18n/i18n-provider';
import { LocalizedSurface } from '../../i18n/localized-surface';

const navigation = [
  ['/os/control-tower', 'nav.controlTower', 'control_tower.read'],
  ['/client-portal', 'nav.clientPortal', 'mission.read'],
  ['/driver-portal', 'nav.driverPortal', 'driver_portal.read'],
  ['/missions', 'nav.missions', 'mission.read'],
  ['/documents', 'nav.documents', 'document.read'],
  ['/closure-policies', 'nav.closurePolicies', 'closure_policy.read'],
  ['/exceptions', 'nav.exceptions', 'exception.read'],
  ['/clients', 'nav.clients', 'client.read'],
  ['/contracts', 'nav.contracts', 'contract.read'],
  ['/routes', 'nav.routes', 'route.read'],
  ['/warehouses', 'nav.warehouses', 'warehouse.read'],
  ['/branches', 'nav.branches', 'branch.read'],
  ['/carriers', 'nav.carriers', 'carrier.read'],
  ['/drivers', 'nav.drivers', 'driver.read'],
  ['/vehicles', 'nav.vehicles', 'vehicle.read'],
  ['/users', 'nav.users', 'user.read'],
  ['/roles', 'nav.roles', 'role.read'],
  ['/rules', 'nav.rules', 'rule.read'],
  ['/alerts', 'nav.alerts', 'alert.read'],
  ['/kpi', 'nav.kpi', 'kpi.read'],
  ['/reports', 'nav.reports', 'daily_loading.read'],
  ['/finance', 'nav.reports', 'daily_loading.read'],
  ['/audit', 'nav.audit', 'audit.read'],
] as const;

export function AuthenticatedApp({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthenticatedAppContent>{children}</AuthenticatedAppContent>
    </I18nProvider>
  );
}

function AuthenticatedAppContent({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const rtl = locale === 'ar-SA';

  if (session.status === 'restoring')
    return <FullPageState message={t('shell.restoring')} retry={t('action.retry')} />;
  if (session.status === 'error') {
    return (
      <FullPageState
        message={session.error ?? t('shell.connectionError')}
        retry={t('action.retry')}
        action={session.retry}
      />
    );
  }
  if (session.status === 'anonymous') {
    return (
      <LoginPanel
        busy={false}
        error={session.error}
        locale={rtl ? 'ar' : 'en'}
        onLocaleChange={(next) => setLocale(next === 'ar' ? 'ar-SA' : 'en')}
        onLogin={session.signIn}
      />
    );
  }

  const activeItem = navigation.find(([href]) => pathname.startsWith(href));
  const permitted = !activeItem || session.hasPermission(activeItem[2]);
  return (
    <div className="app-shell authenticated-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark small">W</span>
          <span>
            <strong>WAFI OS</strong>
            <small>{t('shell.operations')}</small>
          </span>
        </div>
        <nav aria-label={t('shell.navigation')}>
          {navigation
            .filter((item) => session.hasPermission(item[2]))
            .map(([href, key]) => (
              <Link
                key={href}
                href={href}
                className={`nav-item ${pathname.startsWith(href) ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {t(key)}
              </Link>
            ))}
        </nav>
        <div className="sidebar-footer">
          <span className="live-dot" />
          {session.user?.email}
          <br />
          {t('shell.tenant')}: {session.user?.organizationId.slice(0, 8)}
        </div>
      </aside>
      <div className="shell-content">
        <header className="shell-header">
          <button
            className="quiet-button mobile-menu"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
          >
            {t('shell.menu')}
          </button>
          <span className="shell-user">{session.user?.email}</span>
          <button className="quiet-button" onClick={() => setLocale(rtl ? 'en' : 'ar-SA')}>
            {rtl ? 'English · LTR' : 'العربية · RTL'}
          </button>
          <button className="quiet-button" onClick={() => void session.signOut()}>
            {t('shell.signOut')}
          </button>
        </header>
        {permitted ? <LocalizedSurface>{children}</LocalizedSurface> : <ForbiddenState />}
      </div>
    </div>
  );
}

function FullPageState({
  message,
  retry,
  action,
}: {
  message: string;
  retry: string;
  action?: () => Promise<void>;
}) {
  return (
    <main className="login-shell">
      <section className="state-panel" role="status">
        <strong>{message}</strong>
        {action ? (
          <button className="primary-button" onClick={() => void action()}>
            {retry}
          </button>
        ) : null}
      </section>
    </main>
  );
}

function ForbiddenState() {
  const { t } = useI18n();
  return (
    <main className="dashboard">
      <section className="state-panel error-state" role="alert">
        <strong>{t('error.forbidden')}</strong>
        <span>{t('error.forbiddenDetail')}</span>
        <Link className="quiet-button" href="/os/control-tower">
          {t('action.return')}
        </Link>
      </section>
    </main>
  );
}
