'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { I18nProvider, useI18n } from '../../i18n/i18n-provider';
import { getPublicContent } from './content';

const links = [
  ['/', 'home'],
  ['/platform', 'platform'],
  ['/solutions', 'solutions'],
  ['/control-tower', 'controlTower'],
  ['/intelligence', 'intelligence'],
  ['/its', 'its'],
  ['/company', 'company'],
] as const;

export function PublicSiteShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <PublicSiteFrame>{children}</PublicSiteFrame>
    </I18nProvider>
  );
}

function PublicSiteFrame({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const content = getPublicContent(locale);
  const rtl = locale === 'ar-SA';
  const home = pathname === '/';
  return (
    <div className={`public-site ${home ? 'public-site--home' : ''}`}>
      <a className="public-skip" href="#public-content">
        {rtl ? 'تخطَّ إلى المحتوى' : 'Skip to content'}
      </a>
      <header
        className={`public-header ${home ? 'public-header--home' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <div className="public-header__inner">
          <Link className="public-brand" href="/" aria-label={rtl ? 'وافي، الرئيسية' : 'WAFI home'}>
            {home ? (
              <>
                <span className="wafi-routes" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{rtl ? 'وافي العربية' : 'WAFI ARABIA'}</strong>
                  <small>{rtl ? 'للنقل والخدمات اللوجستية' : 'TRANSPORTATION & LOGISTICS'}</small>
                </span>
              </>
            ) : (
              <>
                <span className="public-brand__mark" aria-hidden="true">
                  W
                </span>
                <span>
                  <strong>WAFI</strong>
                  <small>{rtl ? 'منصة عمليات النقل' : 'TRANSPORTATION OS'}</small>
                </span>
              </>
            )}
          </Link>
          <button
            className="public-menu-button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="public-navigation"
          >
            <span aria-hidden="true">{open ? '×' : '☰'}</span>
            {open ? content.nav.close : content.nav.menu}
          </button>
          <nav
            id="public-navigation"
            className={`public-nav ${open ? 'is-open' : ''}`}
            aria-label={rtl ? 'التنقل الرئيسي' : 'Primary navigation'}
          >
            {links.map(([href, key]) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {content.nav[key]}
              </Link>
            ))}
            <div className="public-nav__actions">
              <button
                className="public-language"
                onClick={() => setLocale(rtl ? 'en' : 'ar-SA')}
                aria-label={rtl ? 'Switch to English' : 'التبديل إلى العربية'}
              >
                {rtl ? 'EN' : 'ع'}
              </button>
              <Link className="public-login" href="/login" onClick={() => setOpen(false)}>
                {content.nav.login}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main id="public-content">{children}</main>
      {!home ? (
        <footer className="public-footer">
          <div className="public-footer__top">
            <div>
              <div className="public-brand public-brand--footer">
                <span className="public-brand__mark">W</span>
                <span>
                  <strong>WAFI</strong>
                </span>
              </div>
              <p>{content.common.brandLine}</p>
            </div>
            <nav aria-label={rtl ? 'روابط التذييل' : 'Footer navigation'}>
              {links.slice(1).map(([href, key]) => (
                <Link key={href} href={href}>
                  {content.nav[key]}
                </Link>
              ))}
            </nav>
            <div className="public-footer__access">
              <span>{content.common.loginText}</span>
              <Link className="public-login" href="/login">
                {content.nav.login}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
          <div className="public-footer__bottom">
            <span>WAFI · {new Date().getFullYear()}</span>
            <button onClick={() => setLocale(rtl ? 'en' : 'ar-SA')}>
              {rtl ? 'English' : 'العربية'}
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
