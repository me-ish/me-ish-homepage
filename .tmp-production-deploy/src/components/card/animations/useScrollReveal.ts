// src/components/card/animations/useScrollReveal.ts
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Intersection Observer-based scroll reveal.
 * Returns a ref and a boolean `visible` flag.
 * Only active for premium tier.
 */
export function useScrollReveal(
  enabled: boolean = true,
  threshold: number = 0.15,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [enabled, threshold]);

  return { ref, visible };
}
