"use client";

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type HeroImageSliderProps = {
  images: string[];
  ariaLabel?: string;
  sectionLabel?: string;
  caption?: string;
  imageDescription?: string;
};

export function HeroImageSlider({
  images,
  ariaLabel = 'Featured beauty images',
  sectionLabel = 'Zodiac Beauty',
  caption = 'Beauty, in every detail',
  imageDescription = 'Zodiac Beauty featured skincare and cosmetics',
}: HeroImageSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = images.filter(Boolean).slice(0, 4);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const moveSlide = (direction: -1 | 1) => {
    setActiveIndex((index) => (index + direction + slides.length) % slides.length);
  };

  if (slides.length === 0) return null;

  return (
    <div className="section-card relative overflow-hidden p-3 sm:p-5" role="region" aria-label={ariaLabel} aria-roledescription="carousel">
      <div className="relative overflow-hidden rounded-[24px] bg-[#f7eced]">
        <div
          className="hero-slider-track flex"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          aria-live="polite"
        >
          {slides.map((image, index) => (
            <div key={`${image}-${index}`} className="h-[360px] w-full shrink-0 overflow-hidden sm:h-[500px] lg:h-[540px]">
              <img
                src={image}
                alt={`${imageDescription}, slide ${index + 1}`}
                className={`h-full w-full object-cover ${index === activeIndex ? 'hero-slider-zoom' : ''}`}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 left-5 max-w-[calc(100%-2.5rem)] rounded-[18px] bg-white/85 px-4 py-3 shadow-lg backdrop-blur-md sm:bottom-9 sm:left-9">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#b87580]">{sectionLabel}</p>
        <p className="mt-1 font-serif text-lg text-[#382a2a] sm:text-xl">{caption}</p>
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            aria-label="Previous hero image"
            className="absolute right-[4.25rem] top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#382a2a] shadow-md transition hover:bg-white sm:right-[5.25rem] sm:top-7"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => moveSlide(1)}
            aria-label="Next hero image"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#382a2a] shadow-md transition hover:bg-white sm:right-7 sm:top-7"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-6 right-5 flex items-center gap-2 sm:bottom-10 sm:right-8">
            {slides.map((image, index) => (
              <button
                key={`${image}-dot-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show hero image ${index + 1}`}
                aria-current={activeIndex === index}
                className={`h-2.5 rounded-full transition-all ${activeIndex === index ? 'w-7 bg-[#b87580]' : 'w-2.5 bg-white/90'}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
