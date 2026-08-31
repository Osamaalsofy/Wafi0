'use client';

import Link from 'next/link';
import { useI18n } from '../../../i18n/i18n-provider';
import { getPublicContent } from '../content';
import { BackgroundVideoSlider } from './background-video-slider';
import { SaudiIntelligentNetworkLayer } from './saudi-intelligent-network-layer';
import { SliderProgress } from './slider-progress';

export function HomepageHero() {
  const { locale } = useI18n();
  const c = getPublicContent(locale);
  const arabic = locale === 'ar-SA';

  return (
    <section className="cinematic-hero" aria-labelledby="homepage-hero-title">
      <BackgroundVideoSlider />
      <div className="cinematic-readability-overlay" aria-hidden="true" />
      <SaudiIntelligentNetworkLayer />
      <div className="cinematic-hero__inner">
        <div className="cinematic-hero__content">
          <p className="cinematic-hero__eyebrow"><span />WAFI INTELLIGENT TRANSPORTATION</p>
          <h1 id="homepage-hero-title">{arabic ? 'تشغيل ذكي. نقل متكامل.' : 'Smart Operations. Connected Transportation.'}</h1>
          <p>{arabic ? 'شبكة نقل ذكية تغطي المملكة' : 'An intelligent transportation network across the Kingdom.'}</p>
          <div className="cinematic-hero__actions">
            <Link className="public-primary" href="/platform">{c.common.explore}<span aria-hidden="true">→</span></Link>
            <Link className="cinematic-hero__login" href="/login">{c.nav.login}<span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <SliderProgress locale={locale} />
      </div>
    </section>
  );
}
