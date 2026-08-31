'use client';

import { useEffect, useRef } from 'react';

export const HERO_VIDEO_SLIDES = [
  {
    id: 'truck',
    label: { en: 'Connected road transportation', ar: 'نقل بري مترابط' },
    src: '/media/wafi-hero-truck.mp4',
    poster: '/media/wafi-hero-truck-poster.jpg',
    objectPosition: 'center center',
  },
] as const;

export function BackgroundVideoSlider() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeSlide = HERO_VIDEO_SLIDES[0];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncPlayback = () => {
      if (document.hidden) video.pause();
      else void video.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', syncPlayback);
    return () => document.removeEventListener('visibilitychange', syncPlayback);
  }, []);

  return (
    <div
      className="cinematic-video-stage"
      style={{ '--hero-poster': `url(${activeSlide.poster})` } as React.CSSProperties}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="cinematic-video is-active"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={activeSlide.poster}
        style={{ objectPosition: activeSlide.objectPosition }}
      >
        <source src={activeSlide.src} type="video/mp4" />
      </video>
    </div>
  );
}
