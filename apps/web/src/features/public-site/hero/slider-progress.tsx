import { HERO_VIDEO_SLIDES } from './background-video-slider';

export function SliderProgress({ locale }: { locale: 'ar-SA' | 'en' }) {
  return (
    <div
      className="hero-slider-progress"
      aria-label={locale === 'ar-SA' ? 'مشاهد النقل' : 'Transportation scenes'}
    >
      <div className="hero-slider-progress__numbers">
        <span aria-current="true">
          <i />
          01
        </span>
        <span aria-disabled="true">02</span>
        <span aria-disabled="true">03</span>
        <span aria-disabled="true">04</span>
      </div>
      <b>{locale === 'ar-SA' ? HERO_VIDEO_SLIDES[0].label.ar : HERO_VIDEO_SLIDES[0].label.en}</b>
      <div
        className="hero-slider-progress__controls"
        aria-label={locale === 'ar-SA' ? 'عناصر تحكم الشرائح' : 'Slide controls'}
      >
        <button
          disabled
          aria-label={
            locale === 'ar-SA' ? 'الشريحة السابقة غير متاحة' : 'Previous slide unavailable'
          }
        >
          ←
        </button>
        <button
          disabled
          aria-label={locale === 'ar-SA' ? 'الشريحة التالية غير متاحة' : 'Next slide unavailable'}
        >
          →
        </button>
      </div>
    </div>
  );
}
