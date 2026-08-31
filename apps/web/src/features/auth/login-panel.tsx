'use client';

import { useState, type FormEvent } from 'react';
import type { LoginInput } from '../../lib/api-client';

export function LoginPanel({
  busy,
  error,
  onLogin,
  locale = 'en',
  onLocaleChange,
  variant = 'operations',
}: {
  busy: boolean;
  error?: string;
  onLogin: (input: LoginInput) => Promise<void>;
  locale?: 'en' | 'ar';
  onLocaleChange?: (locale: 'en' | 'ar') => void;
  variant?: 'operations' | 'admin' | 'finance' | 'client' | 'driver';
}) {
  const [values, setValues] = useState<LoginInput>({
    organizationCode: '',
    email: '',
    password: '',
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onLogin(values);
    } catch {
      // SessionProvider exposes the sanitized API error in the form.
    }
  }

  const rtl = locale === 'ar';
  const clientPortal = variant === 'client';
  const driverPortal = variant === 'driver';
  const adminPortal = variant === 'admin';
  const financePortal = variant === 'finance';
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          W
        </div>
        {onLocaleChange ? (
          <button
            className="quiet-button locale-button"
            onClick={() => onLocaleChange(rtl ? 'en' : 'ar')}
          >
            {rtl ? 'English' : 'العربية'}
          </button>
        ) : null}
        <p className="eyebrow">WAFI · {clientPortal ? (rtl ? 'بوابة العميل' : 'CLIENT PORTAL') : driverPortal ? (rtl ? 'بوابة السائق' : 'DRIVER PORTAL') : adminPortal ? (rtl ? 'الإدارة' : 'ADMINISTRATION') : financePortal ? (rtl ? 'المالية والمراجعة' : 'FINANCE & AUDIT') : (rtl ? 'العمليات' : 'OPERATIONS')}</p>
        <h1 id="login-title">
          {clientPortal
            ? (rtl ? 'تسجيل دخول العميل' : 'Client sign in')
            : driverPortal
              ? (rtl ? 'تسجيل دخول السائق' : 'Driver sign in')
            : adminPortal
              ? (rtl ? 'تسجيل دخول مدير النظام' : 'Administrator sign in')
            : financePortal
              ? (rtl ? 'تسجيل دخول المالية' : 'Finance sign in')
            : (rtl ? 'تسجيل الدخول إلى برج المراقبة' : 'Sign in to the Control Tower')}
        </h1>
        <p className="muted">
          {clientPortal
            ? (rtl ? 'ادخل إلى مساحة شركتك المستقلة لمتابعة الشحنات والمستندات.' : 'Access your company’s private shipment and document workspace.')
            : driverPortal
              ? (rtl ? 'تابع مهامك ورحلات اليوم من مساحة ميدانية مخصصة لك.' : 'Access your assignments and today’s trips from your private field workspace.')
            : adminPortal
              ? (rtl ? 'أدر المستخدمين والصلاحيات وإعدادات المنصة.' : 'Manage users, permissions, master data, and platform settings.')
            : financePortal
              ? (rtl ? 'راجع الأداء والمستندات وصدّر التقارير التشغيلية والمالية.' : 'Review performance and documents, then export operational and financial reports.')
            : rtl
            ? 'استخدم بيانات مؤسستك للوصول إلى العمليات المباشرة.'
            : 'Use your organization credentials to access live operational data.'}
        </p>
        <form onSubmit={submit} className="login-form">
          <label>
            {rtl ? 'رمز المؤسسة' : 'Organization code'}
            <input
              required
              minLength={2}
              autoComplete="organization"
              value={values.organizationCode}
              onChange={(event) => setValues({ ...values, organizationCode: event.target.value })}
            />
          </label>
          <label>
            {rtl ? 'البريد الإلكتروني للعمل' : 'Work email'}
            <input
              required
              type="email"
              autoComplete="username"
              value={values.email}
              onChange={(event) => setValues({ ...values, email: event.target.value })}
            />
          </label>
          <label>
            {rtl ? 'كلمة المرور' : 'Password'}
            <input
              required
              minLength={8}
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(event) => setValues({ ...values, password: event.target.value })}
            />
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-button" disabled={busy} type="submit">
            {busy
              ? rtl
                ? 'جارٍ تسجيل الدخول…'
                : 'Signing in…'
              : rtl
                ? 'تسجيل الدخول الآمن'
                : 'Sign in securely'}
          </button>
        </form>
      </section>
    </main>
  );
}
