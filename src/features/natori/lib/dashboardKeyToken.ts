// natori 管理画面の合言葉キーから Cookie 用トークンを導出する。
// Cookie にキー平文を保存しない（漏洩時にキーそのものが露出しない）ための
// HMAC-SHA256 導出。middleware（edge runtime）と server 双方から使うため、
// Node の crypto ではなく Web Crypto (globalThis.crypto.subtle) を使う。
// 純関数（env / cookies / DB 非依存）なので lib/ に置く。

import { NATORI_KEY_COOKIE_MAX_AGE_SECONDS } from "../constants/dashboardKey";

const KEY_PROOF_CONTEXT = "natori-dashboard-cookie-v1";
const COOKIE_TOKEN_CONTEXT = "natori-dashboard-cookie-v2";
const COOKIE_TOKEN_PATTERN = /^(\d{10})\.([0-9a-f]{64})$/;
/** 端末間の時計のずれを許す幅（発行時刻が未来側にずれていても受け付ける上限）。 */
const CLOCK_SKEW_MS = 60_000;

async function hmacHex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 合言葉キーが一致するかを比較するための証明値（時刻を含まない）。
 * Cookie には保存しない。URL で渡されたキーと設定値を、平文のまま比較しないために使う。
 */
export function deriveNatoriDashboardKeyProof(key: string): Promise<string> {
  return hmacHex(key, KEY_PROOF_CONTEXT);
}

/**
 * Cookie 用トークン `<発行時刻(秒)>.<HMAC>` を返す。HMAC は合言葉キーを secret とし、
 * 発行時刻を署名対象に含む。サーバーは発行時刻から 8 時間を超えたものを拒否する
 * （Cookie の maxAge はブラウザ任せなので、サーバー側でも期限を守る）。
 * キーが変われば全 Cookie が無効になる（ローテーション可能）。
 */
export async function deriveNatoriDashboardCookieToken(
  key: string,
  issuedAtMs: number = Date.now()
): Promise<string> {
  const issuedAt = String(Math.floor(issuedAtMs / 1000));
  return `${issuedAt}.${await hmacHex(key, `${COOKIE_TOKEN_CONTEXT}:${issuedAt}`)}`;
}

/** Cookie 値の署名と 8 時間の期限を検証する。形式違い・改ざん・別キー・期限切れ・未来の発行時刻は false。 */
export async function verifyNatoriDashboardCookieToken(
  key: string,
  value: string,
  nowMs: number = Date.now()
): Promise<boolean> {
  const match = COOKIE_TOKEN_PATTERN.exec(value);
  if (!match) return false;
  const age = nowMs - Number(match[1]) * 1000;
  if (age < -CLOCK_SKEW_MS || age > NATORI_KEY_COOKIE_MAX_AGE_SECONDS * 1000) return false;
  const expected = await hmacHex(key, `${COOKIE_TOKEN_CONTEXT}:${match[1]}`);
  return constantTimeEquals(match[2], expected);
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
