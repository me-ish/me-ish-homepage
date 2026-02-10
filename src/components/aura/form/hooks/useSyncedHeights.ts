// src/components/aura/form/hooks/useSyncedHeights.ts
// ResizeObserver-based height sync between form card and preview card.

import { useRef, useState, useEffect } from "react";
import type { StepId } from "../auraFormTypes";

export function useSyncedHeights(currentStep: StepId) {
  const formCardRef = useRef<HTMLDivElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const [syncedHeight, setSyncedHeight] = useState<number | null>(null);

  useEffect(() => {
    const formCard = formCardRef.current;
    if (!formCard) return;

    // lg 以上だけ同期
    const mq = window.matchMedia("(min-width: 1024px)");
    if (!mq.matches) {
      setSyncedHeight(null);
      return;
    }

    const measure = () => {
      const h = Math.round(formCard.getBoundingClientRect().height);
      setSyncedHeight(h);
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(formCard);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [currentStep]);

  return { formCardRef, previewCardRef, syncedHeight };
}
