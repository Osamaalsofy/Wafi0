'use client';

import Link from 'next/link';
import { useI18n } from '../../i18n/i18n-provider';
import { getPublicContent } from './content';
import { SaudiIntelligentNetworkLayer } from './hero/saudi-intelligent-network-layer';

const journeyIcons = ['calendar', 'user', 'truck', 'screen', 'alert', 'shield', 'chart'] as const;
const architectureIcons = ['route', 'fleet', 'clients', 'location', 'alert', 'document'] as const;

export function OperationalJourney() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  return (
    <HomeSection
      number="01"
      className="home-journey"
      title={c.home.whatTitle}
      text={c.home.whatText}
    >
      <ol className="journey-route">
        {c.home.process.map((item, index) => (
          <li key={item} tabIndex={0}>
            <span className="journey-route__node">
              <HomeIcon name={journeyIcons[index]} />
            </span>
            <strong>{item}</strong>
            <small>{String(index + 1).padStart(2, '0')}</small>
          </li>
        ))}
      </ol>
    </HomeSection>
  );
}

export function OperationalArchitecture() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  const rtl = locale === 'ar-SA';
  return (
    <HomeSection
      number="02"
      className="home-architecture home-section--dark"
      title={c.home.capabilityTitle}
      text={
        rtl
          ? 'كل ما تحتاجه لتشغيل عمليات نقل ولوجستية معقدة في منصة واحدة متكاملة.'
          : 'One connected operating system for complex transportation and logistics operations.'
      }
    >
      <div className="os-constellation">
        <div className="os-constellation__routes" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="os-core">
          <span className="wafi-routes" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>WAFI OS</strong>
          <small>{rtl ? 'نظام تشغيل النقل' : 'TRANSPORTATION OS'}</small>
        </div>
        {c.home.capabilities.map((item, index) => (
          <article className={`os-domain os-domain--${index + 1}`} key={item} tabIndex={0}>
            <HomeIcon name={architectureIcons[index]} />
            <h3>{item}</h3>
            <span>
              {rtl
                ? [
                    'إدارة التنفيذ والمحطات',
                    'إدارة موارد الأسطول',
                    'السياق التجاري والتعاقدي',
                    'شبكة الحركة والمواقع',
                    'الانتباه والاستجابة',
                    'الأدلة والحوكمة',
                  ][index]
                : [
                    'Execution and stops',
                    'Fleet resources',
                    'Commercial context',
                    'Movement network',
                    'Attention and response',
                    'Evidence and governance',
                  ][index]}
            </span>
          </article>
        ))}
      </div>
    </HomeSection>
  );
}

export function IntelligencePipeline() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  const rtl = locale === 'ar-SA';
  const stages = rtl
    ? [
        ['حدث', 'حدث تشغيلي من الميدان'],
        ['قاعدة', 'تحقق القواعد والشروط'],
        ['استثناء', 'تم اكتشاف استثناء'],
        ['قرار', 'قرار قابل للتتبع'],
        ['معالجة', 'إجراء تصحيحي وتنفيذ'],
      ]
    : [
        ['Event', 'Operational field event'],
        ['Rule', 'Rules and conditions'],
        ['Exception', 'Exception detected'],
        ['Decision', 'Traceable decision'],
        ['Resolution', 'Corrective action'],
      ];
  return (
    <HomeSection
      number="03"
      className="home-intelligence"
      title={c.home.intelligenceTitle}
      text={c.home.intelligenceText}
    >
      <ol className="intelligence-pipeline">
        {stages.map(([title, text], index) => (
          <li className={index === 2 ? 'is-exception' : ''} key={title} tabIndex={0}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <HomeIcon
              name={
                index === 0
                  ? 'event'
                  : index === 1
                    ? 'rule'
                    : index === 2
                      ? 'alert'
                      : index === 3
                        ? 'decision'
                        : 'shield'
              }
            />
            <strong>{title}</strong>
            <small>{text}</small>
          </li>
        ))}
      </ol>
      <Link className="home-inline-link" href="/intelligence">
        {c.nav.intelligence}
        <span aria-hidden="true">↗</span>
      </Link>
    </HomeSection>
  );
}

export function SaudiNetworkSection() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  const rtl = locale === 'ar-SA';
  const facts = rtl
    ? [
        ['13', 'منطقة إدارية', 'تغطية جغرافية لمرجع المملكة'],
        ['11', 'مدينة تشغيلية', 'عُقد موثقة في العرض الحالي'],
        ['بيانات مكانية', 'موثقة', 'مدن ومواقع أعمال معروفة'],
        ['جاهز للتوسع', 'معمارياً', 'لطبقات النقل المتصل مستقبلاً'],
      ]
    : [
        ['13', 'Administrative regions', 'Kingdom-wide geographic reference'],
        ['11', 'Operational cities', 'Verified nodes in the current view'],
        ['Verified', 'Location data', 'Known cities and business locations'],
        ['Expansion ready', 'Architecture', 'For future connected transport layers'],
      ];
  return (
    <HomeSection
      number="04"
      className="home-kingdom home-section--dark"
      title={c.home.networkTitle}
      text={c.home.networkText}
    >
      <div className="home-network-map">
        <SaudiIntelligentNetworkLayer interactive />
      </div>
      <div className="home-network-facts">
        {facts.map(([value, label, detail]) => (
          <article key={label} tabIndex={0}>
            <strong>{value}</strong>
            <b>{label}</b>
            <span>{detail}</span>
          </article>
        ))}
      </div>
    </HomeSection>
  );
}

export function EnterpriseTrust() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  const rtl = locale === 'ar-SA';
  const items = rtl
    ? [
        ['permissions', 'التحكم والصلاحيات', 'RBAC وصلاحيات دقيقة على مستوى الموارد'],
        ['isolation', 'عزل المستأجرين', 'فصل بيانات كل منشأة'],
        ['audit', 'سجل تدقيق شامل', 'تتبع كامل للقرارات والتغييرات'],
        ['security', 'حوكمة البيانات', 'سجلات تشغيلية منضبطة وقابلة للتتبع'],
      ]
    : [
        ['permissions', 'Access and permissions', 'RBAC and resource-level permissions'],
        ['isolation', 'Tenant isolation', 'Organization data separation'],
        ['audit', 'Comprehensive audit', 'Traceable decisions and changes'],
        ['security', 'Data governance', 'Governed, traceable operational records'],
      ];
  return (
    <HomeSection
      number="05"
      className="home-trust"
      title={rtl ? 'أسس مؤسسية تمنحك الثقة' : 'Enterprise foundations you can trust'}
      text={c.home.securityText}
    >
      <div className="trust-route">
        {items.map(([icon, title, text]) => (
          <article key={title} tabIndex={0}>
            <span>
              <HomeIcon name={icon} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </HomeSection>
  );
}

export function HomeFinalCta() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  const rtl = locale === 'ar-SA';
  return (
    <section className="home-final-cta">
      <div className="home-final-cta__brand">
        <span className="wafi-routes">
          <i />
          <i />
          <i />
        </span>
        <div>
          <strong>{rtl ? 'وافي العربية' : 'WAFI ARABIA'}</strong>
          <small>{rtl ? 'للنقل والخدمات اللوجستية' : 'TRANSPORTATION & LOGISTICS'}</small>
        </div>
      </div>
      <div className="home-final-cta__copy">
        <span>WAFI OS</span>
        <h2>{c.common.loginTitle}</h2>
        <p>{c.common.loginText}</p>
        <Link href="/login">
          {rtl ? 'الدخول إلى WAFI OS' : 'Enter WAFI OS'}
          <b aria-hidden="true">↗</b>
        </Link>
      </div>
      <div className="home-final-cta__legal">© WAFI Arabia · {new Date().getFullYear()}</div>
    </section>
  );
}

function HomeSection({
  number,
  className,
  title,
  text,
  children,
}: {
  number: string;
  className: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`home-section ${className}`}>
      <span className="home-section__number" aria-hidden="true">
        {number}
      </span>
      <div className="home-section__heading">
        <span>{number}</span>
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
      </div>
      <div className="home-section__visual">{children}</div>
    </section>
  );
}

function HomeIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    calendar: 'M5 4h14v15H5zM8 2v4m8-4v4M5 9h14',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.7-4 3-6 7-6s6.3 2 7 6',
    truck:
      'M3 6h11v11H3zM14 10h4l3 4v3h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    screen: 'M3 4h18v13H3zM8 21h8m-4-4v4M7 13l3-3 2 2 5-5',
    alert: 'M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.1',
    shield: 'M12 3 4 6v5c0 5 3.2 8 8 10 4.8-2 8-5 8-10V6l-8-3Zm-3 9 2 2 4-4',
    chart: 'M4 20V10m5 10V4m5 16v-7m5 7V7M2 20h20',
    route: 'M4 18c0-4 5-3 5-7s-4-3-4-6m14 14c0-5-6-4-6-9s5-4 5-7M3 5h4M17 3h3M17 19h4',
    fleet: 'M3 8h18v9H3zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    clients:
      'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6M2 21c.5-4 2.5-6 6-6s5.5 2 6 6m1-6c4 0 6 2 6 6',
    location: 'M12 22s7-7 7-13a7 7 0 1 0-14 0c0 6 7 13 7 13Zm0-10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    document: 'M6 2h8l4 4v16H6zM14 2v5h5M9 12h6m-6 4h6',
    event: 'M4 12h4l2-6 4 12 2-6h4',
    rule: 'M5 5h14M5 12h14M5 19h14M8 3v4m8 3v4m-5 3v4',
    decision: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l3 3m6 6 3 3m0-12-3 3m-6 6-3 3',
    permissions: 'M8 11a4 4 0 1 1 3.8 2.8L9 17H6v3H3v-3l5-5.2V11Z',
    isolation: 'M12 3 4 7v5c0 5 3 8 8 10 5-2 8-5 8-10V7l-8-4Zm0 4v10',
    audit: 'M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5',
    security: 'M12 3a5 5 0 0 0-5 5v3H5v10h14V11h-2V8a5 5 0 0 0-5-5Zm-3 8V8a3 3 0 0 1 6 0v3',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] ?? paths.route} />
    </svg>
  );
}
