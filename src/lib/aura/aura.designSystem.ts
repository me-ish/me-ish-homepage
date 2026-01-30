// src/lib/aiPortfolio/aura.designSystem.ts
// ============================================
// AURA Design System - 全世界観共通のデザイントークン
// ============================================

import type { WorldviewBase } from "./aura.worldviewPresets";

/* ---------------------------------------------------------
 * 1. Spacing（余白）
 * --------------------------------------------------------- */
export const SPACING = {
  /** セクション間の縦余白（統一リズム） */
  section: {
    paddingY: "py-16 md:py-20 lg:py-24",
    paddingX: "px-4 md:px-6 lg:px-8",
    /** セクション内の上下余白（コンパクト版） */
    paddingYCompact: "py-10 md:py-14 lg:py-16",
  },
  /** コンテナ幅 */
  maxWidth: {
    prose: "max-w-prose", // ~65ch (読みやすい文章幅)
    section: "max-w-5xl", // 1024px
    hero: "max-w-6xl", // 1152px
    full: "max-w-7xl", // 1280px
  },
  /** カード内余白 */
  card: {
    padding: "px-5 py-5 md:px-6 md:py-6",
    paddingCompact: "px-4 py-4 md:px-5 md:py-5",
  },
  /** スクロールマージン（固定ヘッダー対応） */
  scrollMargin: "scroll-mt-20 md:scroll-mt-24",
} as const;

/* ---------------------------------------------------------
 * 2. Typography（タイポグラフィ）
 * --------------------------------------------------------- */
export const TYPOGRAPHY = {
  /** 見出し階層 */
  heading: {
    /** Hero見出し（最大） */
    hero: "text-[clamp(2.25rem,5.5vw,4rem)] font-extrabold leading-[1.08] tracking-tight",
    /** Hero副題 */
    heroSub: "text-[clamp(1rem,1.5vw,1.25rem)] font-medium leading-relaxed",
    /** セクション見出し（ピル内） */
    section:
      "text-[11px] md:text-xs font-semibold uppercase tracking-[0.28em]",
    /** カードタイトル */
    card: "text-[15px] md:text-base font-semibold leading-snug",
    /** サブカードタイトル */
    cardSub: "text-sm font-semibold leading-snug",
  },
  /** 本文 */
  body: {
    /** 標準本文 */
    base: "text-[15px] md:text-base leading-[1.85]",
    /** 小さめ本文 */
    small: "text-[13px] md:text-sm leading-[1.8]",
    /** キャプション・注釈 */
    caption: "text-[11px] md:text-xs leading-relaxed",
    /** メタ情報（件数等） */
    meta: "text-[11px] md:text-xs font-medium",
  },
  /** 段落間余白 */
  paragraphGap: "space-y-4",
} as const;

/* ---------------------------------------------------------
 * 3. Radius（角丸）
 * --------------------------------------------------------- */
export const RADIUS = {
  none: "0",
  xs: "0.25rem", // 4px
  sm: "0.375rem", // 6px
  base: "0.5rem", // 8px
  md: "0.75rem", // 12px
  lg: "1rem", // 16px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  full: "9999px",
} as const;

export type RadiusKey = keyof typeof RADIUS;

/* ---------------------------------------------------------
 * 4. Shadow（影）
 * --------------------------------------------------------- */
export const SHADOW = {
  none: "none",
  xs: "0 1px 2px rgba(15,23,42,0.04)",
  sm: "0 2px 8px rgba(15,23,42,0.06)",
  base: "0 4px 16px rgba(15,23,42,0.08)",
  md: "0 8px 30px rgba(15,23,42,0.10)",
  lg: "0 16px 48px rgba(15,23,42,0.12)",
  xl: "0 24px 64px rgba(15,23,42,0.14)",
  /** ダーク用：影を強めに */
  darkBase: "0 8px 32px rgba(0,0,0,0.35)",
  darkLg: "0 20px 60px rgba(0,0,0,0.45)",
  /** ネオン・グロー用 */
  glow: (color: string, intensity = 0.25) =>
    `0 0 24px rgba(${hexToRgbValues(color)},${intensity}), 0 0 48px rgba(${hexToRgbValues(color)},${intensity * 0.5})`,
} as const;

/* ---------------------------------------------------------
 * 5. Border（ボーダー）
 * --------------------------------------------------------- */
export const BORDER = {
  width: {
    thin: "1px",
    base: "1.5px",
    medium: "2px",
  },
  /** 標準ボーダー色（テーマから解決） */
  colorLight: "rgba(148,163,184,0.5)",
  colorDark: "rgba(148,163,184,0.4)",
} as const;

/* ---------------------------------------------------------
 * 6. Transition（トランジション）
 * --------------------------------------------------------- */
export const TRANSITION = {
  fast: "transition-all duration-150 ease-out",
  base: "transition-all duration-200 ease-out",
  slow: "transition-all duration-300 ease-out",
  /** ホバー上昇 */
  hoverLift: "hover:-translate-y-[2px]",
  hoverLiftSm: "hover:-translate-y-[1px]",
  /** ホバー拡大 */
  hoverScale: "hover:scale-[1.02]",
  /** アクティブ押下 */
  activePress: "active:translate-y-0 active:scale-[0.98]",
} as const;

/* ---------------------------------------------------------
 * 7. 世界観ごとのオーバーライド
 * --------------------------------------------------------- */
export type WorldviewOverride = {
  /** 角丸の上書き */
  radiusScale?: "smaller" | "normal" | "larger" | "pill";
  /** 影の上書き */
  shadowIntensity?: "none" | "subtle" | "normal" | "strong" | "glow";
  /** 装飾フラグ */
  decorations: {
    /** スキャンライン（cyber用） */
    scanlines?: boolean;
    /** ネオンボーダー（cyber用） */
    neonBorder?: boolean;
    /** 金縁（luxury用） */
    goldAccent?: boolean;
    /** ノイズテクスチャ */
    noiseTexture?: "always" | "onStrength" | "never";
    /** パターン強度 */
    patternIntensity?: "subtle" | "normal" | "strong";
    /** 角丸強調（cute用） */
    roundedEmphasis?: boolean;
  };
  /** タイポグラフィ微調整 */
  typography?: {
    headingWeight?: "semibold" | "bold" | "extrabold";
    letterSpacingBoost?: boolean;
  };
};

export const WORLDVIEW_OVERRIDES: Record<WorldviewBase, WorldviewOverride> = {
  minimal: {
    radiusScale: "smaller",
    shadowIntensity: "none",
    decorations: {
      noiseTexture: "never",
      patternIntensity: "subtle",
    },
    typography: {
      headingWeight: "semibold",
      letterSpacingBoost: true,
    },
  },
  modern: {
    radiusScale: "normal",
    shadowIntensity: "normal",
    decorations: {
      noiseTexture: "onStrength",
      patternIntensity: "normal",
    },
  },
  business: {
    radiusScale: "smaller",
    shadowIntensity: "subtle",
    decorations: {
      noiseTexture: "never",
      patternIntensity: "subtle",
    },
    typography: {
      headingWeight: "semibold",
    },
  },
  cute: {
    radiusScale: "larger",
    shadowIntensity: "subtle",
    decorations: {
      noiseTexture: "never",
      patternIntensity: "normal",
      roundedEmphasis: true,
    },
    typography: {
      headingWeight: "bold",
    },
  },
  pop: {
    radiusScale: "larger",
    shadowIntensity: "strong",
    decorations: {
      noiseTexture: "never",
      patternIntensity: "strong",
    },
    typography: {
      headingWeight: "extrabold",
    },
  },
  dark: {
    radiusScale: "normal",
    shadowIntensity: "strong",
    decorations: {
      noiseTexture: "always",
      patternIntensity: "subtle",
    },
  },
  cyber: {
    radiusScale: "smaller",
    shadowIntensity: "glow",
    decorations: {
      scanlines: true,
      neonBorder: true,
      noiseTexture: "always",
      patternIntensity: "normal",
    },
    typography: {
      letterSpacingBoost: true,
    },
  },
  natural: {
    radiusScale: "larger",
    shadowIntensity: "subtle",
    decorations: {
      noiseTexture: "onStrength",
      patternIntensity: "subtle",
    },
  },
  luxury: {
    radiusScale: "normal",
    shadowIntensity: "normal",
    decorations: {
      goldAccent: true,
      noiseTexture: "onStrength",
      patternIntensity: "subtle",
    },
    typography: {
      headingWeight: "semibold",
      letterSpacingBoost: true,
    },
  },
  retro: {
    radiusScale: "larger",
    shadowIntensity: "strong",
    decorations: {
      noiseTexture: "onStrength",
      patternIntensity: "strong",
    },
    typography: {
      headingWeight: "bold",
    },
  },
};

/* ---------------------------------------------------------
 * 8. ヘルパー関数
 * --------------------------------------------------------- */

/** 世界観からオーバーライドを取得 */
export function getWorldviewOverride(
  worldview: WorldviewBase | string
): WorldviewOverride {
  const key = worldview as WorldviewBase;
  return WORLDVIEW_OVERRIDES[key] ?? WORLDVIEW_OVERRIDES.business;
}

/** radiusScaleから実際の値を解決 */
export function resolveRadius(
  scale: WorldviewOverride["radiusScale"],
  base: RadiusKey = "md"
): string {
  const scaleMap: Record<
    NonNullable<WorldviewOverride["radiusScale"]>,
    RadiusKey
  > = {
    smaller: "sm",
    normal: "md",
    larger: "xl",
    pill: "full",
  };
  const key = scale ? scaleMap[scale] : base;
  return RADIUS[key];
}

/** shadowIntensityから実際の値を解決 */
export function resolveShadow(
  intensity: WorldviewOverride["shadowIntensity"],
  isDark: boolean,
  accentColor?: string
): string {
  if (!intensity || intensity === "none") return SHADOW.none;

  if (intensity === "glow" && accentColor) {
    return SHADOW.glow(accentColor, isDark ? 0.35 : 0.2);
  }

  const lightMap: Record<string, string> = {
    subtle: SHADOW.sm,
    normal: SHADOW.base,
    strong: SHADOW.lg,
  };
  const darkMap: Record<string, string> = {
    subtle: SHADOW.base,
    normal: SHADOW.darkBase,
    strong: SHADOW.darkLg,
  };

  return isDark ? darkMap[intensity] ?? SHADOW.base : lightMap[intensity] ?? SHADOW.base;
}

/** HEX → RGB値（カンマ区切り文字列） */
function hexToRgbValues(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `${r},${g},${b}`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }
  return "15,23,42"; // fallback
}

/* ---------------------------------------------------------
 * 9. Tailwindクラスビルダー
 * --------------------------------------------------------- */

/** セクションコンテナのクラス生成 */
export function sectionContainerClass(
  options: {
    compact?: boolean;
    maxWidth?: keyof typeof SPACING.maxWidth;
  } = {}
): string {
  const py = options.compact
    ? SPACING.section.paddingYCompact
    : SPACING.section.paddingY;
  const px = SPACING.section.paddingX;
  const mw = SPACING.maxWidth[options.maxWidth ?? "section"];
  return `relative ${py} ${px} mx-auto w-full ${mw} ${SPACING.scrollMargin}`;
}

/** カード共通クラス */
export function cardClass(options: { compact?: boolean } = {}): string {
  const padding = options.compact
    ? SPACING.card.paddingCompact
    : SPACING.card.padding;
  return `border ${padding} ${TRANSITION.base} ${TRANSITION.hoverLiftSm}`;
}

/** 見出しクラス（レベル指定） */
export function headingClass(
  level: keyof typeof TYPOGRAPHY.heading
): string {
  return TYPOGRAPHY.heading[level];
}

/** 本文クラス（サイズ指定） */
export function bodyClass(size: keyof typeof TYPOGRAPHY.body = "base"): string {
  return TYPOGRAPHY.body[size];
}

/* ---------------------------------------------------------
 * 10. 装飾レイヤー生成
 * --------------------------------------------------------- */

export type DecorationLayers = {
  /** スキャンライン背景CSS */
  scanlinesBg?: string;
  /** ネオンボーダーCSS */
  neonBorderStyle?: React.CSSProperties;
  /** 金縁CSS */
  goldBorderStyle?: React.CSSProperties;
  /** ノイズテクスチャ表示 */
  showNoise: boolean;
  /** パターンの透明度 */
  patternOpacity: number;
};

export function buildDecorationLayers(
  worldview: WorldviewBase | string,
  overallStrength: number,
  accentColor: string,
  isDark: boolean
): DecorationLayers {
  const override = getWorldviewOverride(worldview);
  const deco = override.decorations;

  // ノイズ表示判定
  let showNoise = false;
  if (deco.noiseTexture === "always") showNoise = true;
  else if (deco.noiseTexture === "onStrength" && overallStrength >= 40)
    showNoise = true;

  // パターン透明度
  const patternOpacity =
    deco.patternIntensity === "strong"
      ? 0.12
      : deco.patternIntensity === "subtle"
        ? 0.04
        : 0.07;

  const result: DecorationLayers = {
    showNoise,
    patternOpacity,
  };

  // スキャンライン（cyber）
  if (deco.scanlines) {
    result.scanlinesBg = `repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(${isDark ? "255,255,255" : "0,0,0"},0.03) 2px,
      rgba(${isDark ? "255,255,255" : "0,0,0"},0.03) 4px
    )`;
  }

  // ネオンボーダー（cyber）
  if (deco.neonBorder) {
    result.neonBorderStyle = {
      boxShadow: `0 0 8px ${accentColor}40, 0 0 16px ${accentColor}20, inset 0 0 8px ${accentColor}10`,
      borderColor: accentColor,
    };
  }

  // 金縁（luxury）
  if (deco.goldAccent) {
    const gold = "#D4AF37";
    result.goldBorderStyle = {
      borderColor: gold,
      boxShadow: `0 0 0 1px ${gold}30, 0 4px 20px rgba(212,175,55,0.15)`,
    };
  }

  return result;
}
