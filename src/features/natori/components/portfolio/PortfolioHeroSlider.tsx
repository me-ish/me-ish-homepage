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
const SWIPE_THRESHOLD_PX = 48;
const SWIPE_DIRECTION_RATIO = 1.1;

type TouchOrigin = {
  identifier: number;
  x: number;
  y: number;
  axis: "horizontal" | "vertical" | null;
};

export default function PortfolioHeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [touching, setTouching] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const touchOriginRef = useRef<TouchOrigin | null>(null);
  const paused = hovered || focusWithin || touching || dragging || animating;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      startTransition((activeIndex + 1) % slides.length, 1);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // The timer restarts after each completed slide, manual selection, or pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, paused, reducedMotion, slides.length]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (!animating) return;
    // Some browsers omit transitionend when a tab is hidden mid-animation.
    const fallback = window.setTimeout(() => {
      if (pendingIndex !== null) setActiveIndex(pendingIndex);
      setPendingIndex(null);
      setDragX(0);
      setAnimating(false);
    }, 500);
    return () => window.clearTimeout(fallback);
  }, [animating, pendingIndex]);

  if (slides.length === 0) return null;

  const hasMultiple = slides.length > 1;
  const wrap = (index: number) => (index + slides.length) % slides.length;
  const startTransition = (index: number, nextDirection: 1 | -1) => {
    const target = wrap(index);
    if (target === activeIndex || animating) return;
    setDragging(false);
    if (reducedMotion) {
      setDragX(0);
      setActiveIndex(target);
      return;
    }
    setDirection(nextDirection);
    setPendingIndex(target);
    setAnimating(true);
  };

  const settleTransition = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.propertyName && event.propertyName !== "transform")) return;
    if (pendingIndex !== null) setActiveIndex(pendingIndex);
    setPendingIndex(null);
    setDragX(0);
    setAnimating(false);
  };

  const snapBack = () => {
    setDragging(false);
    if (dragX !== 0 && !reducedMotion) {
      setAnimating(true);
      setDragX(0);
    } else {
      setDragX(0);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!hasMultiple || animating) return;
    setTouching(event.touches.length > 0);
    if (event.touches.length !== 1) {
      touchOriginRef.current = null;
      snapBack();
      return;
    }
    const touch = event.touches[0];
    touchOriginRef.current = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      axis: null,
    };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const origin = touchOriginRef.current;
    if (
      !origin ||
      event.touches.length !== 1 ||
      event.touches[0]?.identifier !== origin.identifier
    ) {
      touchOriginRef.current = null;
      snapBack();
      setTouching(event.touches.length > 0);
      return;
    }
    setTouching(event.touches.length > 0);
    const deltaX = event.touches[0].clientX - origin.x;
    const deltaY = event.touches[0].clientY - origin.y;
    if (origin.axis === null && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      origin.axis = Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_DIRECTION_RATIO
        ? "horizontal"
        : "vertical";
    }
    if (origin.axis === "horizontal") {
      setDragging(true);
      const width = surfaceRef.current?.clientWidth ?? 0;
      setDragX(width ? Math.max(-width, Math.min(width, deltaX)) : deltaX);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const origin = touchOriginRef.current;
    touchOriginRef.current = null;
    setTouching(event.touches.length > 0);
    if (!origin || !hasMultiple) {
      snapBack();
      return;
    }

    const touch = Array.from(event.changedTouches).find(
      (changedTouch) => changedTouch.identifier === origin.identifier,
    );
    if (!touch) {
      snapBack();
      return;
    }

    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (
      horizontalDistance < SWIPE_THRESHOLD_PX ||
      horizontalDistance <= verticalDistance * SWIPE_DIRECTION_RATIO ||
      origin.axis === "vertical"
    ) {
      snapBack();
      return;
    }

    startTransition(activeIndex + (deltaX < 0 ? 1 : -1), deltaX < 0 ? 1 : -1);
  };

  const cancelTouch = () => {
    touchOriginRef.current = null;
    setTouching(false);
    snapBack();
  };

  const previousSlide = slides[pendingIndex !== null && direction === -1 ? pendingIndex : wrap(activeIndex - 1)];
  const activeSlide = slides[activeIndex] ?? slides[0];
  const nextSlide = slides[pendingIndex !== null && direction === 1 ? pendingIndex : wrap(activeIndex + 1)];
  const trackPosition = pendingIndex !== null
    ? direction === 1 ? "-66.666667%" : "0%"
    : `calc(-33.333333% + ${dragX}px)`;

  return (
    <div
      ref={rootRef}
      className="w-full"
      role="region"
      aria-roledescription="carousel"
      aria-label="代表作品"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !rootRef.current?.contains(nextTarget)) {
          setFocusWithin(false);
        }
      }}
    >
      <div
        ref={surfaceRef}
        data-testid="hero-slide-surface"
        className="relative aspect-square touch-pan-y select-none overflow-hidden rounded-2xl border"
        style={{ background: c.surfaceSubtle, borderColor: c.borderSubtle }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={cancelTouch}
      >
        <div
          data-testid="hero-slide-track"
          className="absolute inset-y-0 left-0 flex w-[300%]"
          style={{
            transform: `translate3d(${trackPosition}, 0, 0)`,
            transition: animating ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
          onTransitionEnd={settleTransition}
        >
          {[previousSlide, activeSlide, nextSlide].map((slide, slot) => (
            <div key={`${slot}-${slide.src}`} className="relative h-full w-1/3 shrink-0" aria-hidden={slot !== 1}>
              <Image
                src={slide.src}
                alt={slot === 1 ? slide.alt : ""}
                fill
                priority={slot === 1 && activeIndex === 0}
                loading={slot === 1 && activeIndex === 0 ? undefined : "eager"}
                sizes="(min-width: 1024px) 512px, (min-width: 768px) 46vw, calc(100vw - 40px)"
                className="pointer-events-none object-contain"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={() => startTransition(activeIndex - 1, -1)}
              className="pf-cute-focus absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border bg-white/90 shadow-sm backdrop-blur hover:bg-white"
              style={{ borderColor: c.borderSubtle, color: c.text }}
              aria-label="前の作品"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => startTransition(activeIndex + 1, 1)}
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
              onClick={() => startTransition(index, index > activeIndex ? 1 : -1)}
              className="pf-cute-focus grid h-8 w-8 place-items-center rounded-full"
              aria-label={`${index + 1}枚目を表示`}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              <span
                className="block h-2.5 w-2.5 rounded-full transition-transform"
                style={{
                  background: c.action,
                  opacity: index === activeIndex ? 1 : 0.25,
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
