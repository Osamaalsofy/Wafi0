'use client';

import { I18nProvider, useI18n } from '../../i18n/i18n-provider';
import { LoginPanel } from '../auth/login-panel';
import { SessionProvider, useSession } from '../auth/session-provider';
import { DriverCommandDashboard } from './driver-command-dashboard';

export function DriverPortalApp() { return <SessionProvider><I18nProvider><DriverPortalContent /></I18nProvider></SessionProvider>; }

function DriverPortalContent() {
  const session = useSession(); const { locale, setLocale } = useI18n(); const ar = locale === 'ar-SA';
  if (session.status === 'restoring') return <Gate message={ar ? 'جارٍ استعادة جلسة السائق…' : 'Restoring driver session…'} />;
  if (session.status === 'error') return <Gate message={session.error ?? (ar ? 'تعذر الاتصال' : 'Unable to connect')} />;
  if (session.status === 'anonymous') return <LoginPanel variant="driver" busy={false} error={session.error} locale={ar ? 'ar' : 'en'} onLocaleChange={(next) => setLocale(next === 'ar' ? 'ar-SA' : 'en')} onLogin={session.signIn} />;
  if (!session.hasPermission('driver_portal.read')) return <main className="driver-portal-gate"><section className="state-panel error-state"><strong>{ar ? 'هذا الحساب غير مرتبط ببوابة سائق' : 'This account is not linked to a driver portal'}</strong><a className="quiet-button" href="/os/control-tower">{ar ? 'نظام العمليات' : 'Operations system'}</a><button className="quiet-button" onClick={() => void session.signOut()}>{ar ? 'تسجيل الخروج' : 'Sign out'}</button></section></main>;
  return <div className="standalone-driver-shell" dir={ar ? 'rtl' : 'ltr'}><header className="standalone-driver-header"><a href="/driver"><span>W</span><div><strong>WAFI DRIVER</strong><small>{ar ? 'مساحة العمل الميدانية' : 'FIELD WORKSPACE'}</small></div></a><div><button className="quiet-button" onClick={() => setLocale(ar ? 'en' : 'ar-SA')}>{ar ? 'English' : 'العربية'}</button><button className="quiet-button" onClick={() => void session.signOut()}>{ar ? 'خروج' : 'Sign out'}</button></div></header><DriverCommandDashboard accessToken={session.session!.accessToken} /><footer className="standalone-client-footer"><span>WAFI Driver Portal</span><span>{ar ? 'تظهر هنا فقط الرحلات المسندة إلى حسابك.' : 'Only assignments linked to your driver account appear here.'}</span></footer></div>;
}
function Gate({ message }: { message: string }) { return <main className="driver-portal-gate"><section className="state-panel" role="status"><strong>{message}</strong></section></main>; }
