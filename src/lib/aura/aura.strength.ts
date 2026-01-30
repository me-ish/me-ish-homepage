// ============================================
// aura.strength.ts（完全版）
//
// 役割：
//
// 1) UIのスライダー値（2本 or 1本）から
//    内部の「AI強度7項目」にマッピングする
//
//    - worldviewStrength
//    - patternStrength
//    - surfaceStrength
//    - fontStrength
//    - layoutStrength
//    - showcaseStrength
//    - variantStrength
//
// 2) 画像枚数 + 強度 から Hero / Works の
//    レイアウト種別（enum）を決定する
//
//    - HeroLayoutId
//    - WorksLayoutId
//
// ============================================

/** 安全な 0–100 clamp */
function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(100, Math.max(0, Math.round(x)));
}

/** UIで扱う「AI自由度」スライダー（2本版） */
export type AiStrengthUI = {
  /** 世界観ゆらぎ：色 / 柄 / 質感 / フォント寄り */
  worldviewFlex: number; // 0-100
  /** 構成ゆらぎ：レイアウト / 見せ方寄り */
  structureFlex: number; // 0-100
};

/**
 *  将来「1本版」にしたくなったとき用の型。
 *  （今は使わなくてもOK）
 */
export type AiStrengthUISingle = {
  freedom: number; // 0-100
};

/** 内部で使う「AI強度7項目」 */
export type AiStrengthInternal = {
  worldviewStrength: number;
  patternStrength: number;
  surfaceStrength: number;
  fontStrength: number;
  layoutStrength: number;
  showcaseStrength: number;
  variantStrength: number;
};

/** Heroレイアウト ID */
export type HeroLayoutId =
  | "heroCenterBasic" // 文字中心
  | "heroVisualSide"  // 画像 + テキスト横並び
  | "heroVisualOverlay"; // 画像の上に文字を重ねる少し攻めレイアウト

/** Worksレイアウト ID */
export type WorksLayoutId =
  | "worksSingleSpotlight" // 1枚ドンと見せる
  | "worksGrid"            // ふつうのグリッド
  | "worksMasonryLike";    // 少しズラした「なんちゃってマasonry」風

/** レイアウト決定に必要な最低限の入力情報 */
export type LayoutContext = {
  imagesCount: number;
  hasFeatured?: boolean;
};

/* --------------------------------------------
 * 1) 2本スライダー → 7項目マッピング
 * ------------------------------------------ */

/**
 * 2本スライダー（worldviewFlex / structureFlex）
 * から 7つの AI 強度を生成する。
 *
 * - 世界観まわり：worldview / pattern / surface / font / variant(7割)
 * - 構成まわり：layout / showcase / variant(3割)
 */
export function mapAiStrengthFromUI(ui: AiStrengthUI): AiStrengthInternal {
  const worldviewFlex = clamp01(ui.worldviewFlex);
  const structureFlex = clamp01(ui.structureFlex);

  // 世界観寄りの強度群
  const worldviewStrength = worldviewFlex;
  const patternStrength = worldviewFlex;
  const surfaceStrength = worldviewFlex;
  const fontStrength = worldviewFlex;

  // 構成寄りの強度群
  const layoutStrength = structureFlex;
  const showcaseStrength = structureFlex;

  // バリアントは世界観7:構成3くらいのブレンド
  const variantStrength = clamp01(
    worldviewFlex * 0.7 + structureFlex * 0.3
  );

  return {
    worldviewStrength,
    patternStrength,
    surfaceStrength,
    fontStrength,
    layoutStrength,
    showcaseStrength,
    variantStrength,
  };
}

/**
 * 1本スライダー（freedom）から 7項目を作る簡易版。
 * 「とりあえず全部同じ」で良い場合用。
 */
export function mapAiStrengthFromSingle(
  ui: AiStrengthUISingle
): AiStrengthInternal {
  const v = clamp01(ui.freedom);
  return {
    worldviewStrength: v,
    patternStrength: v,
    surfaceStrength: v,
    fontStrength: v,
    layoutStrength: v,
    showcaseStrength: v,
    variantStrength: v,
  };
}

/* --------------------------------------------
 * 2) Hero レイアウト決定ロジック
 * ------------------------------------------ */

/**
 * Heroレイアウトを決める。
 *
 * 概要：
 * - 画像0枚：文字中心（heroCenterBasic）
 * - 画像1枚：
 *    - 世界観ゆらぎが低い → heroCenterBasic（安全）
 *    - 高い → heroVisualOverlay（画像上にテキスト重ね）
 * - 画像2枚以上：
 *    - 構成ゆらぎが中程度まで → heroVisualSide
 *    - 高い → heroVisualOverlay
 */
export function decideHeroLayout(
  strengths: AiStrengthInternal,
  ctx: LayoutContext
): HeroLayoutId {
  const { imagesCount } = ctx;
  const w = strengths.worldviewStrength;
  const s = strengths.layoutStrength; // 構成寄りを見る

  if (imagesCount <= 0) {
    return "heroCenterBasic";
  }

  if (imagesCount === 1) {
    if (w < 25 && s < 25) {
      // かなり保守的
      return "heroCenterBasic";
    }
    if (s < 60) {
      // レイアウトはそこまで攻めない：画像＋テキスト並列
      return "heroVisualSide";
    }
    // 世界観 or 構成どちらかが高め → 少し攻めた被せ
    return "heroVisualOverlay";
  }

  // 画像が複数ある場合は、「作品の集合をチラ見せ」したいので
  // まずは side ベースで、かなり攻めていれば overlay
  if (s >= 70 || w >= 80) {
    return "heroVisualOverlay";
  }

  return "heroVisualSide";
}

/* --------------------------------------------
 * 3) Works レイアウト決定ロジック
 * ------------------------------------------ */

/**
 * Worksレイアウトを決める。
 *
 * 概要：
 * - 0枚：Grid扱い（空のプレースホルダ）
 * - 1枚：必ず SingleSpotlight
 * - 2〜3枚：
 *    - 構成ゆらぎ < 60 → Grid
 *    - 構成ゆらぎ >= 60 → MasonryLike
 * - 4枚以上：
 *    - 構成ゆらぎ < 40 → Grid
 *    - 構成ゆらぎ >= 40 → MasonryLike
 */
export function decideWorksLayout(
  strengths: AiStrengthInternal,
  ctx: LayoutContext
): WorksLayoutId {
  const { imagesCount } = ctx;
  const s = strengths.showcaseStrength; // 見せ方寄り

  if (imagesCount <= 0) {
    // まだ作品がない場合も Grid として扱う
    return "worksGrid";
  }

  if (imagesCount === 1) {
    // 1枚は必ず「ドン」と見せる
    return "worksSingleSpotlight";
  }

  if (imagesCount <= 3) {
    // 枚数少ないときは Grid ベース
    if (s >= 60) {
      return "worksMasonryLike";
    }
    return "worksGrid";
  }

  // 4枚以上：ギャラリー感を出したい
  if (s >= 40) {
    return "worksMasonryLike";
  }

  return "worksGrid";
}

/* --------------------------------------------
 * 4) まとめて決定するヘルパー
 * ------------------------------------------ */

/**
 * UI入力（2本スライダー）から
 *  - 内部強度7項目
 *  - HeroLayoutId
 *  - WorksLayoutId
 * をまとめて返すヘルパー。
 */
export function resolveAiStrengthAndLayouts(
  ui: AiStrengthUI,
  ctx: LayoutContext
): {
  strengths: AiStrengthInternal;
  heroLayout: HeroLayoutId;
  worksLayout: WorksLayoutId;
} {
  const strengths = mapAiStrengthFromUI(ui);
  const heroLayout = decideHeroLayout(strengths, ctx);
  const worksLayout = decideWorksLayout(strengths, ctx);
  return { strengths, heroLayout, worksLayout };
}
