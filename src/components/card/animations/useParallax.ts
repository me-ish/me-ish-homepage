// src/components/card/animations/useParallax.ts
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Parallax scroll hook - returns a Y offset value based on scroll position.
 * Only active for premium tier.
 */
export function useParallax(enabled: boolean = true, speed: number = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementCenter = rect.top + rect.height / 2;
      const distFromCenter = elementCenter - windowHeight / 2;
      setOffset(distFromCenter * speed);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [enabled, speed]);

  return { ref, offset };
}
