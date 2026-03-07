// src/components/aura/form/AuraFormPreview.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { AuraFormData } from "./auraFormTypes";
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";
import { buildMockContent, buildMockDesign } from "./auraPreviewMocks";
import AuraPortfolioRenderer from "@/components/aura/AuraPortfolioRenderer";

type Props = {
  data: AuraFormData;
};

/** 仮想的なレンダリング幅（デスクトップ相当） */
const RENDER_WIDTH = 1200;

export function AuraFormPreview({ data }: Props) {
  // 計測用 ref（スクロール要素とは別にする）
  const measureRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);

  // 計測div のサイズを監視
  // スクロールバーの出入りと完全に分離しているため zoom のフィードバックループが起きない
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    let lastW = 0;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0 && Math.abs(w - lastW) > 1) {
        lastW = w;
        setContainerWidth(w);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const preset = useMemo(
    () => getWorldviewPreset(data.worldviewBase),
    [data.worldviewBase],
  );

  const mockDesign = useMemo(
    () => buildMockDesign(data.worldviewBase, data.aiSwing, preset, data.color || undefined, {
      fontPreset: data.fontPreset,
      surfaceStyle: data.surfaceStyle,
      showcaseStyle: data.showcaseStyle,
      layoutPref: data.layoutPref,
      avatarShape: data.avatarShape,
      avatarSize: data.avatarSize,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data.worldviewBase, data.aiSwing, preset, data.color,
      data.fontPreset, data.surfaceStyle, data.showcaseStyle, data.layoutPref,
      data.avatarShape, data.avatarSize,
    ],
  );

  const mockContent = useMemo(
    () => buildMockContent(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data.name, data.title, data.tagline, data.bio, data.avatarPreviewUrl, data.avatarShape, data.avatarSize,
      data.images, data.services, data.skillPresets, data.manualSkills,
      data.contactEmail, data.twitter, data.instagram, data.behance, data.website,
      data.sections, data.aboutLayout,
    ],
  );

  const zoom = containerWidth / RENDER_WIDTH;

  return (
    // 外枠：relative で内部の absolute div の基準になる
    <div className="relative w-full h-full">
      {/* 計測専用div：スクロール要素に影響されない幅を取得するため absolute inset-0 */}
      <div ref={measureRef} className="absolute inset-0 pointer-events-none" />

      {/* スクロール可能なコンテンツ領域：計測divとは独立 */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
        <div
          style={{
            width: RENDER_WIDTH,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            zoom: zoom as any,
            pointerEvents: "none",
          }}
        >
          <AuraPortfolioRenderer design={mockDesign} content={mockContent} previewMode />
        </div>
      </div>
    </div>
  );
}
