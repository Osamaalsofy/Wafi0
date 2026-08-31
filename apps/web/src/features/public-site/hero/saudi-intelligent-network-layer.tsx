'use client';

import { useI18n } from '../../../i18n/i18n-provider';
import { SAUDI_HERO_BOUNDS, SAUDI_HERO_CITIES, SAUDI_HERO_PATH } from './saudi-geometry';

const ROUTES = [
  ['riyadh', 'jeddah'],
  ['riyadh', 'dammam'],
  ['riyadh', 'qassim'],
  ['riyadh', 'madinah'],
  ['riyadh', 'abha'],
  ['riyadh', 'tabuk'],
  ['jeddah', 'makkah'],
  ['jeddah', 'madinah'],
  ['dammam', 'khobar'],
  ['dammam', 'jubail'],
  ['abha', 'jazan'],
] as const;

function project(latitude: number, longitude: number) {
  const x =
    4 +
    ((longitude - SAUDI_HERO_BOUNDS.minLongitude) /
      (SAUDI_HERO_BOUNDS.maxLongitude - SAUDI_HERO_BOUNDS.minLongitude)) *
      92;
  const y =
    12.5 +
    ((SAUDI_HERO_BOUNDS.maxLatitude - latitude) /
      (SAUDI_HERO_BOUNDS.maxLatitude - SAUDI_HERO_BOUNDS.minLatitude)) *
      75;
  return { x, y };
}

const POINTS = Object.fromEntries(
  SAUDI_HERO_CITIES.map((city) => [city.id, project(city.latitude, city.longitude)]),
);

export function SaudiIntelligentNetworkLayer({ interactive = false }: { interactive?: boolean }) {
  const { locale } = useI18n();
  const arabic = locale === 'ar-SA';

  return (
    <figure
      className={`hero-network ${interactive ? 'is-interactive' : ''}`}
      aria-label={
        arabic
          ? 'شبكة نقل ذكية توضيحية عبر المملكة العربية السعودية'
          : 'Illustrative intelligent transportation network across Saudi Arabia'
      }
    >
      <svg viewBox="0 0 100 100" role="img">
        <defs>
          <filter id="hero-node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path className="hero-kingdom-fill" d={SAUDI_HERO_PATH} />
        <g className="hero-network-routes">
          {ROUTES.map(([from, to], index) => {
            const a = POINTS[from];
            const b = POINTS[to];
            const path = `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 3} ${b.x} ${b.y}`;
            return (
              <path
                id={`hero-route-${index}`}
                className={index > 5 ? 'is-secondary' : ''}
                d={path}
                key={`${from}-${to}`}
              />
            );
          })}
        </g>
        <g className="hero-route-particles" aria-hidden="true">
          {[0, 1, 3, 4].map((index) => (
            <circle r=".42" key={index}>
              <animateMotion
                dur={`${5 + index * 0.7}s`}
                begin={`${index * -0.9}s`}
                repeatCount="indefinite"
              >
                <mpath href={`#hero-route-${index}`} />
              </animateMotion>
            </circle>
          ))}
        </g>
        <g className="hero-network-cities">
          {SAUDI_HERO_CITIES.map((city) => {
            const point = POINTS[city.id];
            return (
              <g
                className={`hero-city hero-city--${city.tier}`}
                transform={`translate(${point.x} ${point.y})`}
                key={city.id}
                data-city={city.id}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? (arabic ? city.ar : city.en) : undefined}
              >
                <circle className="hero-city__pulse" r={city.tier === 'primary' ? 4.2 : 2.4} />
                <circle
                  className="hero-city__node"
                  r={city.tier === 'primary' ? 1.35 : 0.75}
                  filter="url(#hero-node-glow)"
                />
                <text x="2.4" y=".8">
                  {arabic ? city.ar : city.en}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption>
        {arabic ? 'شبكة توضيحية · ليست بيانات GPS مباشرة' : 'ILLUSTRATIVE NETWORK · NOT LIVE GPS'}
      </figcaption>
    </figure>
  );
}
