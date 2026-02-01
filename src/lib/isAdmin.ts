// src/lib/isAdmin.ts
// 管理者判定ロジック
// - DBのadmin_emailsテーブルを優先
// - フォールバック: 環境変数ADMIN_EMAILS

import { createClient } from "@supabase/supabase-js";

// キャッシュ（TTL: 5分）
let cachedAdminEmails: Set<string> | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * 環境変数から管理者メールを取得（フォールバック用）
 */
function getEnvAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * DBから管理者メールを取得（キャッシュ付き）
 */
async function fetchAdminEmailsFromDB(): Promise<Set<string> | null> {
  const admin = supabaseAdmin();
  if (!admin) return null;

  try {
    const { data, error } = await admin.from("admin_emails").select("email");

    if (error) {
      return null;
    }

    return new Set(
      (data ?? []).map((row: { email: string }) => row.email.toLowerCase())
    );
  } catch (e) {
    return null;
  }
}

/**
 * 管理者メールセットを取得（キャッシュ優先、DB、環境変数の順）
 */
async function getAdminEmails(): Promise<Set<string>> {
  const now = Date.now();

  // キャッシュが有効なら使用
  if (cachedAdminEmails && now < cacheExpiry) {
    return cachedAdminEmails;
  }

  // DBから取得を試行
  const dbEmails = await fetchAdminEmailsFromDB();

  if (dbEmails && dbEmails.size > 0) {
    cachedAdminEmails = dbEmails;
    cacheExpiry = now + CACHE_TTL_MS;
    return dbEmails;
  }

  // DBが空またはエラーの場合、環境変数にフォールバック
  const envEmails = getEnvAdminEmails();
  cachedAdminEmails = envEmails;
  cacheExpiry = now + CACHE_TTL_MS;
  return envEmails;
}

/**
 * 管理者判定（同期版・環境変数のみ）
 * ※後方互換用。新規コードではisAdminEmailAsyncを使用推奨
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const allow = getEnvAdminEmails();
  return allow.has(email.toLowerCase());
}

/**
 * 管理者判定（非同期版・DB優先）
 * サーバーサイドで使用推奨
 */
export async function isAdminEmailAsync(
  email?: string | null
): Promise<boolean> {
  if (!email) return false;
  const allow = await getAdminEmails();
  return allow.has(email.toLowerCase());
}

/**
 * キャッシュをクリア（管理者変更時に呼び出し可能）
 */
export function clearAdminEmailCache(): void {
  cachedAdminEmails = null;
  cacheExpiry = 0;
}
