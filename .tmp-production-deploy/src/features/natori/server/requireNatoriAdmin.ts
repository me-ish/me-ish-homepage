import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminEmailAsync } from "@/lib/isAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { NATORI_KEY_COOKIE } from "@/features/natori/constants/dashboardKey";
import { deriveNatoriDashboardCookieToken } from "@/features/natori/lib/dashboardKeyToken";
import { safeCompare } from "@/lib/auth/timingSafe";

function getNatoriStaffEmails(): Set<string> {
  const raw = [
    process.env.NATORI_STAFF_EMAILS,
    process.env.NATORI_OWNER_EMAILS,
  ]
    .filter(Boolean)
    .join(",");

  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function canAccessNatoriManagement(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (await isAdminEmailAsync(email)) return true;
  return getNatoriStaffEmails().has(email.toLowerCase());
}

export async function requireNatoriAdmin(nextPath: string): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  if (!email || !(await isAdminEmailAsync(email))) {
    redirect(`/admin-login?err=unauthorized&next=${encodeURIComponent(nextPath)}`);
  }
}

function getNatoriDashboardKey(): string | null {
  const key = process.env.NATORI_DASHBOARD_KEY?.trim();
  return key ? key : null;
}

async function hasNatoriKeyCookie(): Promise<boolean> {
  const key = getNatoriDashboardKey();
  if (!key) return false;
  const cookieValue = (await cookies()).get(NATORI_KEY_COOKIE)?.value;
  if (!cookieValue) return false;
  // Cookie にはキー平文ではなく HMAC トークンを保存する（middleware.ts 参照）。
  const expectedToken = await deriveNatoriDashboardCookieToken(key);
  return safeCompare(cookieValue, expectedToken);
}

/**
 * natori 管理画面（ダッシュボード・案件管理・見積もり・ポートフォリオ編集）の
 * アクセス可否。ページ・API 共通で使う。
 *
 * デフォルトは deny。以下のいずれかを満たす場合のみ許可する:
 * - NATORI_DASHBOARD_KEY を設定した合言葉キー方式: `?natori-key=<値>` 付き URL を
 *   一度開くと HMAC トークン Cookie がセットされ、以後ログイン不要
 *   （middleware.ts 参照）。
 * - Supabase ログイン（admin / NATORI_STAFF_EMAILS / NATORI_OWNER_EMAILS）。
 *
 * env が何も設定されていない場合は全拒否（フェイルクローズ）。
 */
export async function canUseNatoriManagement(): Promise<boolean> {
  if (await hasNatoriKeyCookie()) return true;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return canAccessNatoriManagement(user?.email ?? null);
}

export async function requireNatoriAccess(nextPath: string): Promise<void> {
  if (await canUseNatoriManagement()) return;
  redirect(`/admin-login?err=unauthorized&next=${encodeURIComponent(nextPath)}`);
}
