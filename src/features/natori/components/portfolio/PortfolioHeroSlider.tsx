"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

type HeroSlide = {
  src: string;
  alt: string;
};

const AUTOPLAY_INTERVAL_MS = 5000;

export default function PortfolioHeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeIndex, paused, reducedMotion, slides.length]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  if (slides.length === 0) return null;

  const activeSlide = slides[activeIndex] ?? slides[0];
  const hasMultiple = slides.length > 1;
  const goTo = (index: number) => setActiveIndex((index + slides.length) % slides.length);

  return (
    <div
      ref={rootRef}
      className="w-full"
      role="region"
      aria-roledescription="carousel"
      aria-label="代表作品"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !rootRef.current?.contains(nextTarget)) {
          setPaused(false);
        }
      }}
    >
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border"
        style={{ background: c.surfaceSubtle, borderColor: c.borderSubtle }}
      >
        <Image
          key={activeSlide.src}
          src={activeSlide.src}
          alt={activeSlide.alt}
          fill
          priority={activeIndex === 0}
          sizes="(min-width: 1024px) 512px, (min-width: 768px) 46vw, calc(100vw - 40px)"
          className="object-contain"
        />

        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="pf-cute-focus absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border bg-white/90 shadow-sm backdrop-blur hover:bg-white"
              style={{ borderColor: c.borderSubtle, color: c.text }}
              aria-label="前の作品"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="pf-cute-focus absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border bg-white/90 shadow-sm backdrop-blur hover:bg-white"
              style={{ borderColor: c.borderSubtle, color: c.text }}
              aria-label="次の作品"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {hasMultiple ? (
        <div className="mt-3 flex items-center justify-center gap-2" aria-label="表示する作品を選択">
          {slides.map((slide, index) => (
            <button
              key={`${slide.src}-${index}`}
              type="button"
              onClick={() => goTo(index)}
              className="pf-cute-focus grid h-8 w-8 place-items-center rounded-full"
              aria-label={`${index + 1}枚目を表示`}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              <span
                className="block h-2.5 w-2.5 rounded-full transition-transform"
                style={{
                  background: index === activeIndex ? c.actionDisplay : c.borderSubtle,
                  transform: index === activeIndex ? "scale(1.2)" : undefined,
                }}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
