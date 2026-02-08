// src/lib/constants.ts
// プロジェクト共通の定数・ヘルパー

// ============================================================
// Site URL
// ============================================================

/** 本番URL（フォールバック用。環境変数があればそちらを優先） */
export const PRODUCTION_URL = "https://me-ish.art";

/**
 * サーバーサイドで使う base URL を返す。
 * 優先順位: NEXT_PUBLIC_SITE_URL > VERCEL_URL > localhost
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// ============================================================
// Email template で使う共通リンク
// ============================================================

export function getEmailLinks() {
  const base = getSiteUrl();
  return {
    siteUrl: base,
    faqUrl: `${base}/faq`,
    termsUrl: `${base}/footer/terms`,
    mypageUrl: `${base}/mypage`,
    adminPayoutsUrl: `${base}/admin/payouts`,
    renewUrl: `${base}/renew`,
  };
}

// ============================================================
// Upload limits
// ============================================================

/** アバター画像の最大サイズ (bytes) */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/** 作品画像の最大サイズ (bytes) */
export const WORKS_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/** 許可する画像 MIME タイプ */
export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// ============================================================
// External API timeouts
// ============================================================

/** OpenAI API タイムアウト (ms) */
export const OPENAI_TIMEOUT_MS = 10_000;

// ============================================================
// Fee calculation
// ============================================================

/** me-ish 手数料率 (10%) */
export const FEE_RATE = 0.1;

/** 手数料計算: fee = floor(price * 0.1) */
export function calcFee(price: number): number {
  return Math.floor(price * FEE_RATE);
}

/** 報酬計算: reward = price - fee（端数ズレ防止） */
export function calcReward(price: number): number {
  return price - calcFee(price);
}
