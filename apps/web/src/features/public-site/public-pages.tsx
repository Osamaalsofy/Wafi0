'use client';

import Link from 'next/link';
import { useI18n } from '../../i18n/i18n-provider';
import { getPublicContent, type PublicPageContent, type PublicPageKey } from './content';
import { SaudiNetworkVisual } from './saudi-network-visual';
import { HomepageHero } from './hero/homepage-hero';
import {
  EnterpriseTrust,
  HomeFinalCta,
  IntelligencePipeline,
  OperationalArchitecture,
  OperationalJourney,
  SaudiNetworkSection,
} from './homepage-sections';

export function HomePublicPage() {
  return (
    <>
      <HomepageHero />
      <OperationalJourney />
      <OperationalArchitecture />
      <IntelligencePipeline />
      <SaudiNetworkSection />
      <EnterpriseTrust />
      <HomeFinalCta />
    </>
  );
}

export function StandardPublicPage({ page }: { page: PublicPageKey }) {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  const data = c.pages[page] as PublicPageContent;
  const visualMode = page === 'its' ? 'its' : page === 'controlTower' ? 'tower' : undefined;
  const rtl = locale === 'ar-SA';
  return (
    <>
      <section className={`public-hero public-hero--inner public-hero--${page}`}>
        <div className="public-hero__copy">
          <p className="public-eyebrow">{data.eyebrow}</p>
          <h1>{data.title}</h1>
          <p className="public-lead">{data.lead}</p>
          {page === 'its' ? (
            <span className="future-label">{c.common.future}</span>
          ) : (
            <span className="current-label">{c.common.current}</span>
          )}
        </div>
        {visualMode ? (
          <SaudiNetworkVisual mode={visualMode} />
        ) : (
          <ArchitectureVisual page={page} rtl={rtl} />
        )}
      </section>
      {data.flow ? (
        <section className="public-section public-section--flow">
          <SectionHeading
            kicker="01"
            title={
              page === 'its'
                ? rtl
                  ? 'مسار التطور المستقبلي'
                  : 'Future architecture direction'
                : page === 'company'
                  ? rtl
                    ? 'مسار تطور وافي'
                    : 'WAFI progression'
                  : rtl
                    ? 'منظومة مترابطة'
                    : 'Connected operating flow'
            }
          />
          <Flow items={[...data.flow]} compact={data.flow.length > 6} />
        </section>
      ) : null}
      <section className="public-section">
        <SectionHeading
          kicker={data.flow ? '02' : '01'}
          title={
            page === 'solutions'
              ? rtl
                ? 'حلول مبنية حول العمل الحقيقي'
                : 'Built around real operational work'
              : page === 'platform'
                ? rtl
                  ? 'قدرات المنصة'
                  : 'Platform capabilities'
                : page === 'company'
                  ? rtl
                    ? 'رؤية منتج واضحة'
                    : 'A clear product direction'
                  : rtl
                    ? 'من الرؤية إلى العمل'
                    : 'From visibility to action'
          }
        />
        <div
          className={`public-card-grid ${data.sections.length === 3 ? 'public-card-grid--three' : ''}`}
        >
          {data.sections.map((section, index) => (
            <article className="public-card" key={section.title}>
              <span className="public-card__index">0{index + 1}</span>
              {section.tag ? <span className="future-label">{section.tag}</span> : null}
              <h2>{section.title}</h2>
              <p>{section.text}</p>
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      {page === 'intelligence' ? (
        <section className="public-section intelligence-distinction">
          <div>
            <b>{rtl ? 'الذكاء التشغيلي' : 'OPERATIONAL INTELLIGENCE'}</b>
            <p>
              {rtl
                ? 'ماذا يحدث داخل عملياتي، ولماذا، ومن يجب أن يتصرف؟'
                : 'What is happening inside the operation, why, and who needs to act?'}
            </p>
          </div>
          <span>≠</span>
          <div>
            <b>ITS · {rtl ? 'رؤية مستقبلية' : 'FUTURE VISION'}</b>
            <p>
              {rtl
                ? 'ماذا يحدث للمركبات والبنية التحتية في العالم الفعلي؟'
                : 'What is happening to vehicles and transport infrastructure in the physical world?'}
            </p>
          </div>
        </section>
      ) : null}
      <FinalLogin />
    </>
  );
}

function SectionHeading({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <div className="public-section-heading">
      <span>{kicker}</span>
      <div>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
    </div>
  );
}
function Flow({ items, compact = false }: { items: readonly string[]; compact?: boolean }) {
  return (
    <ol className={`public-flow ${compact ? 'is-compact' : ''}`}>
      {items.map((item, index) => (
        <li key={item}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{item}</strong>
        </li>
      ))}
    </ol>
  );
}
function ArchitectureVisual({ page, rtl }: { page: PublicPageKey; rtl: boolean }) {
  const map: Record<string, string[]> = {
    platform: rtl
      ? ['التخطيط', 'التنفيذ', 'الرقابة', 'الحوكمة']
      : ['PLANNING', 'EXECUTION', 'CONTROL', 'GOVERNANCE'],
    solutions: rtl
      ? ['الأسطول', 'النقل', 'التوزيع', '3PL']
      : ['FLEET', 'TRANSPORT', 'DISTRIBUTION', '3PL'],
    intelligence: rtl
      ? ['الأحداث', 'القواعد', 'الإجراءات', 'القياس']
      : ['EVENTS', 'RULES', 'ACTIONS', 'MEASUREMENT'],
    company: rtl
      ? ['التشغيل', 'الذكاء', 'الاتصال', 'المستقبل']
      : ['OPERATIONS', 'INTELLIGENCE', 'CONNECTED', 'FUTURE'],
    controlTower: [],
    its: [],
  };
  return (
    <div className="architecture-visual">
      <strong>WAFI OS</strong>
      {(map[page] ?? []).map((item, index) => (
        <span key={item} style={{ '--i': index } as React.CSSProperties}>
          {item}
        </span>
      ))}
    </div>
  );
}
function FinalLogin() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  return (
    <section className="public-final">
      <div>
        <p className="public-eyebrow">WAFI OS</p>
        <h2>{c.common.loginTitle}</h2>
        <p>{c.common.loginText}</p>
      </div>
      <Link className="public-primary" href="/login">
        {c.nav.login}
        <span aria-hidden="true">↗</span>
      </Link>
    </section>
  );
}
