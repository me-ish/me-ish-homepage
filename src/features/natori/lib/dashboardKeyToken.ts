// natori 管理画面の合言葉キーから Cookie 用トークンを導出する。
// Cookie にキー平文を保存しない（漏洩時にキーそのものが露出しない）ための
// HMAC-SHA256 導出。middleware（edge runtime）と server 双方から使うため、
// Node の crypto ではなく Web Crypto (globalThis.crypto.subtle) を使う。
// 純関数（env / cookies / DB 非依存）なので lib/ に置く。

const COOKIE_TOKEN_CONTEXT = "natori-dashboard-cookie-v1";

/**
 * 合言葉キーを secret とした HMAC-SHA256(固定コンテキスト文字列) を hex で返す。
 * キーが変われば全 Cookie が無効になる（ローテーション可能）。
 */
export async function deriveNatoriDashboardCookieToken(
  key: string
): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(COOKIE_TOKEN_CONTEXT)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 定数時間の文字列比較。edge runtime には Node の timingSafeEqual が無いため、
 * middleware ではこちらを使う（server では @/lib/auth/timingSafe の safeCompare 可）。
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
