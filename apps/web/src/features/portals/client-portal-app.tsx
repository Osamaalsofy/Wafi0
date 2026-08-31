'use client';

import { useState } from 'react';
import { I18nProvider, useI18n } from '../../i18n/i18n-provider';
import { LoginPanel } from '../auth/login-panel';
import { SessionProvider, useSession } from '../auth/session-provider';
import { ClientPortalDashboard } from './client-portal-dashboard';

export function ClientPortalApp() {
  return <SessionProvider><I18nProvider><ClientPortalContent /></I18nProvider></SessionProvider>;
}

function ClientPortalContent() {
  const session = useSession();
  const { locale, setLocale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const rtl = locale === 'ar-SA';

  if (session.status === 'restoring') return <PortalState message={rtl ? 'جارٍ استعادة جلسة العميل…' : 'Restoring customer session…'} />;
  if (session.status === 'error') return <PortalState message={session.error ?? (rtl ? 'تعذر الاتصال' : 'Unable to connect')} retry={() => void session.retry()} />;
  if (session.status === 'anonymous') return <LoginPanel variant="client" busy={false} error={session.error} locale={rtl ? 'ar' : 'en'} onLocaleChange={(next) => setLocale(next === 'ar' ? 'ar-SA' : 'en')} onLogin={session.signIn} />;

  const clientGrants = session.user?.grants.filter((grant) => grant.scopeType === 'CLIENT') ?? [];
  const isClientAccount = clientGrants.some((grant) => grant.permission === 'control_tower.read') &&
    !session.user?.grants.some((grant) => grant.permission === 'control_tower.read' && grant.scopeType === 'ORGANIZATION');
  if (!isClientAccount) return <main className="client-portal-gate"><section className="state-panel error-state"><strong>{rtl ? 'هذا الحساب ليس حساب عميل' : 'This is not a client account'}</strong><span>{rtl ? 'استخدم رابط نظام العمليات الخاص بالموظفين.' : 'Use the employee operations sign-in instead.'}</span><a className="quiet-button" href="/os/control-tower">{rtl ? 'نظام العمليات' : 'Operations system'}</a><button className="quiet-button" onClick={() => void session.signOut()}>{rtl ? 'تسجيل الخروج' : 'Sign out'}</button></section></main>;

  return <div className="standalone-client-shell" dir={rtl ? 'rtl' : 'ltr'}>
    <header className="standalone-client-header">
      <a className="standalone-client-brand" href="/portal"><span>W</span><div><strong>WAFI</strong><small>{rtl ? 'بوابة العميل' : 'CLIENT PORTAL'}</small></div></a>
      <button className="quiet-button client-menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{rtl ? 'الحساب' : 'Account'}</button>
      <div className={menuOpen ? 'client-account-menu open' : 'client-account-menu'}>
        <span>{session.user?.email}</span>
        <button className="quiet-button" onClick={() => setLocale(rtl ? 'en' : 'ar-SA')}>{rtl ? 'English' : 'العربية'}</button>
        <button className="quiet-button" onClick={() => void session.signOut()}>{rtl ? 'تسجيل الخروج' : 'Sign out'}</button>
      </div>
    </header>
    <ClientPortalDashboard accessToken={session.session!.accessToken} />
    <footer className="standalone-client-footer"><span>WAFI Client Portal</span><span>{rtl ? 'بيانات شركتك معزولة ومحمية حسب صلاحيات الحساب.' : 'Your company data is isolated by account permissions.'}</span></footer>
  </div>;
}

function PortalState({ message, retry }: { message: string; retry?: () => void }) {
  return <main className="client-portal-gate"><section className="state-panel" role="status"><strong>{message}</strong>{retry ? <button className="primary-button" onClick={retry}>Retry</button> : null}</section></main>;
}
