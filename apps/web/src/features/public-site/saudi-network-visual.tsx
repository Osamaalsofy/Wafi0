'use client';

import { useI18n } from '../../i18n/i18n-provider';
import { getPublicContent } from './content';

const nodes = [
  { x: 51, y: 47, en: 'Riyadh', ar: 'الرياض', major: true },
  { x: 24, y: 54, en: 'Jeddah', ar: 'جدة', major: true },
  { x: 27, y: 47, en: 'Makkah', ar: 'مكة' },
  { x: 27, y: 35, en: 'Madinah', ar: 'المدينة' },
  { x: 72, y: 40, en: 'Dammam', ar: 'الدمام', major: true },
  { x: 41, y: 25, en: 'Qassim', ar: 'القصيم' },
  { x: 23, y: 72, en: 'Abha', ar: 'أبها' },
  { x: 26, y: 16, en: 'Tabuk', ar: 'تبوك' },
  { x: 19, y: 82, en: 'Jazan', ar: 'جازان' },
];

export function SaudiNetworkVisual({ mode = 'network' }: { mode?: 'network' | 'tower' | 'its' }) {
  const { locale } = useI18n();
  const content = getPublicContent(locale);
  const rtl = locale === 'ar-SA';
  return (
    <figure className={`saudi-visual saudi-visual--${mode}`} aria-label={rtl ? 'تصور توضيحي لشبكة النقل السعودية' : 'Illustrative Saudi transportation network'}>
      <div className="saudi-visual__top"><span><i />{mode === 'its' ? content.common.future : rtl ? 'شبكة المملكة' : 'KINGDOM NETWORK'}</span><span>13 {rtl ? 'منطقة' : 'REGIONS'}</span></div>
      <svg viewBox="0 0 100 100" role="img" aria-labelledby={`map-title-${mode}`}>
        <title id={`map-title-${mode}`}>{rtl ? 'شبكة نقل توضيحية تربط مدن المملكة' : 'Illustrative transportation corridors connecting Saudi cities'}</title>
        <defs><filter id={`glow-${mode}`}><feGaussianBlur stdDeviation="1.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path className="saudi-outline" d="M28 6 43 12 54 18 69 20 82 28 77 43 83 52 72 62 63 83 50 94 35 87 21 77 14 62 18 48 15 35 23 24Z" />
        <g className="network-grid"><path d="M17 34 78 34M15 50 81 50M20 66 72 66M31 10 31 85M49 14 49 93M67 20 67 75" /></g>
        <g className="network-routes" filter={`url(#glow-${mode})`}><path d="M24 54 Q38 48 51 47 T72 40"/><path d="M26 16 Q33 30 27 35 T24 54 Q20 67 19 82"/><path d="M41 25 Q46 34 51 47 T23 72"/><path d="M72 40 Q60 30 41 25"/></g>
        {nodes.map((node) => <g key={node.en} className={`network-node ${node.major ? 'is-major' : ''}`} transform={`translate(${node.x} ${node.y})`}><circle className="node-pulse" r={node.major ? 3.4 : 2.5}/><circle r={node.major ? 1.25 : .9}/><text x="2.4" y="-1.5">{rtl ? node.ar : node.en}</text></g>)}
      </svg>
      {mode === 'tower' ? <div className="tower-overlay"><span>{rtl ? 'طبقات التشغيل' : 'OPERATION LAYERS'}</span><b>{rtl ? 'المواقع' : 'Locations'}</b><b>{rtl ? 'المهام' : 'Missions'}</b><b>{rtl ? 'الاستثناءات' : 'Exceptions'}</b></div> : null}
      {mode === 'its' ? <div className="its-layers"><span>{rtl ? 'طبقة المركبة' : 'VEHICLE LAYER'}</span><span>{rtl ? 'طبقة الطريق' : 'ROAD LAYER'}</span><span>{rtl ? 'طبقة الذكاء' : 'INTELLIGENCE LAYER'}</span></div> : null}
      <figcaption>{content.common.illustrative}</figcaption>
    </figure>
  );
}
