// src/lib/aiPortfolio/aiPortfolio.background.ts
import type { CSSProperties } from "react";
import type { Design } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type {
  PatternId,
  VariantSpec,
} from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import { getPatternDef } from "@/lib/aiPortfolio/aiPortfolio.patternRegistry";

/* ---------------------------------------------------------
 * グリッド系のラインカラーを worldview ごとに出し分け
 * --------------------------------------------------------- */
export function getGridLineColor(
  variant: VariantSpec,
  theme: Design["theme"]
): string {
  switch (variant.worldview) {
    case "minimal":
    case "business":
      return "#e5e7eb"; // slate-200
    case "dark":
    case "cyber":
    case "luxury":
      return theme.colorAccent || theme.colorPrimary;
    default:
      return theme.colorPrimary;
  }
}

/* ---------------------------------------------------------
 * PatternId → CSS 生成（registry優先）
 * --------------------------------------------------------- */
export function patternStyle(
  pattern: PatternId | "none",
  color: string
): CSSProperties {
  if (!pattern || pattern === "none") return {};
  const def = getPatternDef(pattern as PatternId);
  if (def) return def.buildStyle(color);
  return {};
}

/* ---------------------------------------------------------
 * グラデーション＋柄レイヤー＋テクスチャ＋bgStyle を合成
 * - CSS multiple backgrounds: 先頭が最前面
 * - 先頭ほど前に来るため「texture → pattern → gradient（最背面）」で積む
 * --------------------------------------------------------- */
export function buildBackgroundStyle(
  theme: Design["theme"],
  variant: VariantSpec
): CSSProperties {
  const anyTheme = theme as any;

  const baseColor = theme.colorBG;

  // 1) preset bgStyle（あれば土台として使うが、早期returnしない）
  const presetBgStyle = anyTheme.bgStyle as CSSProperties | undefined;

  // 2) 色：patternColor（無ければ primary）
  const rawPatternColor = anyTheme.patternColor || theme.colorPrimary;

  // 3) グリッド系は worldview でライン色を切り替え
  const lineColor = getGridLineColor(variant, theme);

  // ✅ grid系判定（ID prefix でまとめる：grid-thin/grid-neon/grid-subtle/grid-cyber など）
  const isGridLike = (p: string) => p.startsWith("grid-");

  // 4) patternLayers（theme.patternLayers 優先、無ければ backgroundPattern/variant.pattern）
  const rawPatternLayers: unknown = anyTheme.patternLayers;
  const patternLayers: (PatternId | "none")[] =
    Array.isArray(rawPatternLayers) && rawPatternLayers.length > 0
      ? (rawPatternLayers as (PatternId | "none")[])
      : ([
          ((theme.backgroundPattern as PatternId | undefined) ??
            (variant.pattern as PatternId | undefined) ??
            "none") as PatternId | "none",
        ] as (PatternId | "none")[]);

  // 5) textureLayers（任意文字列配列を許容）
  const rawTextureLayers: unknown = anyTheme.textureLayers;
  const textureLayers: string[] = Array.isArray(rawTextureLayers)
    ? (rawTextureLayers as string[])
    : [];

  // 6) bgGradient（文字列想定）
  const bgGradient: string | undefined = anyTheme.bgGradient;

  // --- 合成 ---
  const images: string[] = [];
  const sizes: string[] = [];
  const repeats: string[] = [];
  const positions: string[] = [];
  const blends: string[] = []; // ✅ 追加：レイヤーごとの blend

  const pushLayer = (style: CSSProperties) => {
    const bgImg = (style.backgroundImage as string | undefined) ?? "";
    if (!bgImg) return;

    images.push(bgImg);
    sizes.push(((style.backgroundSize as string | undefined) ?? "auto"));
    repeats.push(((style.backgroundRepeat as string | undefined) ?? "repeat"));
    positions.push(
      ((style.backgroundPosition as string | undefined) ?? "0 0")
    );
    blends.push(
      ((style.backgroundBlendMode as string | undefined) ?? "normal")
    );
  };

  // ✅ レイヤー順を修正：
  // texture（最前面）→ pattern → gradient（最背面）
  // ※ multiple backgrounds: 先頭が最前面

  // C) textureLayers（最前面）
  for (const t of textureLayers) {
    if (!t) continue;
    const tid = t as any as PatternId; // registryに登録されていれば描画される
    pushLayer(patternStyle(tid, rawPatternColor));
  }

  // B) patternLayers（textureの次）
  for (const p of patternLayers) {
    if (!p || p === "none") continue;

    const color = isGridLike(String(p)) ? lineColor : rawPatternColor;
    pushLayer(patternStyle(p, color));
  }

  // A) bgGradient（最背面に置くため最後にpush）
  if (bgGradient && typeof bgGradient === "string" && bgGradient.trim()) {
    images.push(bgGradient);
    sizes.push("cover");
    repeats.push("no-repeat");
    positions.push("center");
    blends.push("normal");
  }

  // D) presetBgStyle をマージ（backgroundImageは合成結果を優先）
  const merged: CSSProperties = {
    backgroundColor: baseColor,
    ...(presetBgStyle ?? {}),
  };

  if (images.length > 0) {
    merged.backgroundImage = images.join(", ");
    merged.backgroundSize = sizes.join(", ");
    merged.backgroundRepeat = repeats.join(", ");
    merged.backgroundPosition = positions.join(", ");
    merged.backgroundBlendMode = blends.join(", "); // ✅ 追加
  }

  return merged;
}
