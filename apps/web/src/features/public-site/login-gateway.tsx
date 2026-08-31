'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { I18nProvider, useI18n } from '../../i18n/i18n-provider';
import { LoginPanel } from '../auth/login-panel';
import { SessionProvider, useSession } from '../auth/session-provider';

export function LoginGateway() {
  return <SessionProvider><I18nProvider><LoginGatewayContent /></I18nProvider></SessionProvider>;
}

function LoginGatewayContent() {
  const session = useSession();
  const router = useRouter();
  const { locale, setLocale } = useI18n();
  const rtl = locale === 'ar-SA';
  const [selected, setSelected] = useState<'admin' | 'operations' | 'finance'>();
  useEffect(() => {
    if (session.status !== 'authenticated') return;
    const destination = selected === 'admin'
      ? '/users'
      : selected === 'finance'
        ? '/finance'
        : '/os/control-tower';
    router.replace(destination);
  }, [router, selected, session.status]);
  if (session.status === 'restoring' || session.status === 'authenticated') return <main className="login-shell"><section className="state-panel" role="status"><strong>{rtl ? 'جارٍ تجهيز جلسة WAFI OS…' : 'Preparing your WAFI OS session…'}</strong></section></main>;
  if (session.status === 'error') return <main className="login-shell"><section className="state-panel error-state" role="alert"><strong>{session.error}</strong><button className="primary-button" onClick={() => void session.retry()}>{rtl?'إعادة المحاولة':'Retry'}</button></section></main>;
  if (selected) return <div className="login-choice-flow" dir={rtl ? 'rtl' : 'ltr'}>
    <button className="quiet-button login-choice-back" onClick={() => setSelected(undefined)}>
      {rtl ? '← اختيار نوع آخر' : '← Choose another account type'}
    </button>
    <LoginPanel variant={selected} busy={false} error={session.error} locale={rtl?'ar':'en'} onLocaleChange={(next)=>setLocale(next==='ar'?'ar-SA':'en')} onLogin={session.signIn}/>
  </div>;
  const choices: Array<{
    key: 'admin' | 'operations' | 'client' | 'driver' | 'finance';
    icon: string;
    title: string;
    detail: string;
    href?: string;
  }> = [
    { key: 'admin', icon: '⚙', title: rtl ? 'مدير النظام' : 'Administrator', detail: rtl ? 'المستخدمون، الصلاحيات والإعدادات' : 'Users, permissions, and settings' },
    { key: 'operations', icon: '◉', title: rtl ? 'موظف العمليات' : 'Operations', detail: rtl ? 'برج المراقبة، المهام والاستثناءات' : 'Control tower, missions, and exceptions' },
    { key: 'client', icon: '▣', title: rtl ? 'العميل' : 'Client', detail: rtl ? 'الشحنات، التتبع والمستندات' : 'Shipments, tracking, and documents', href: '/portal' },
    { key: 'driver', icon: '↗', title: rtl ? 'السائق' : 'Driver', detail: rtl ? 'الرحلات، نقاط التوقف والتسليم' : 'Trips, stops, and delivery', href: '/driver' },
    { key: 'finance', icon: '≡', title: rtl ? 'المالية والمراجعة' : 'Finance & Audit', detail: rtl ? 'التقارير، الامتثال والتصدير' : 'Reports, compliance, and exports' },
  ];
  return <main className="login-role-shell" dir={rtl ? 'rtl' : 'ltr'}>
    <section className="login-role-panel">
      <div className="login-role-heading"><div className="brand-mark">W</div><div><p className="eyebrow">WAFI OS · ACCESS</p><h1>{rtl ? 'كيف تريد الدخول؟' : 'How would you like to sign in?'}</h1><p className="muted">{rtl ? 'اختر مساحة العمل المناسبة لحسابك.' : 'Choose the workspace that matches your account.'}</p></div></div>
      <button className="quiet-button locale-button" onClick={() => setLocale(rtl ? 'en' : 'ar-SA')}>{rtl ? 'English' : 'العربية'}</button>
      <div className="login-role-grid">{choices.map((choice) => choice.href
        ? <Link className="login-role-card" href={choice.href} key={choice.key}><span className="login-role-icon">{choice.icon}</span><strong>{choice.title}</strong><small>{choice.detail}</small><b aria-hidden="true">←</b></Link>
        : <button className="login-role-card" key={choice.key} onClick={() => setSelected(choice.key as 'admin' | 'operations' | 'finance')}><span className="login-role-icon">{choice.icon}</span><strong>{choice.title}</strong><small>{choice.detail}</small><b aria-hidden="true">←</b></button>
      )}</div>
      <Link className="login-home-link" href="/">{rtl ? 'العودة إلى الصفحة الرئيسية' : 'Return to homepage'}</Link>
    </section>
  </main>;
}
