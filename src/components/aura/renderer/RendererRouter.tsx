// src/components/aura/renderer/RendererRouter.tsx
// ============================================
// Renderer バージョンルーター（Server Component）
// - renderer_version の MAJOR を見て適切な Renderer を選択
// - next/dynamic は使わず、静的 import で切り替え
// ============================================

import type { Design, Content } from "@/lib/aura/aura.schema";
import { getMajorVersion } from "@/lib/aura/aura.db";

// V1 Renderer（現行）
import { RendererV1 } from "./v1";

// 将来の V2 はここに追加:
// import { RendererV2 } from "./v2";

export type RendererProps = {
  design: Design;
  content: Content;
  sectionOrder?: string[];
};

type Props = RendererProps & {
  /** DB から取得した renderer_version（SemVer 形式: "1.0.0"） */
  rendererVersion: string;
};

/**
 * Renderer バージョンルーター
 *
 * - Server Component として動作（"use client" 無し）
 * - rendererVersion の MAJOR を見て適切な Renderer を返す
 * - 未知のバージョンは V1 にフォールバック
 */
export function RendererRouter({ rendererVersion, design, content, sectionOrder }: Props) {
  const major = getMajorVersion(rendererVersion);

  // MAJOR バージョンで分岐
  switch (major) {
    // 将来の V2:
    // case 2:
    //   return <RendererV2 design={design} content={content} sectionOrder={sectionOrder} />;

    case 1:
    default:
      // V1 または未知のバージョンは V1 にフォールバック
      return <RendererV1 design={design} content={content} sectionOrder={sectionOrder} />;
  }
}
