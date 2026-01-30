// src/lib/aiPortfolio/auraBillingGate.ts
// ============================================
// AURA 課金ゲート（無料判定・消費ロジック）
// ============================================
//
// ✅ 新設計（推奨）
// - 先着20名無料: aura_first20_redemptions（converted_to_meish_at で返還管理）
// - me-ish採用無料: aura_meish_free_claims
// - 上限設定のみ: aura_promo_counters（limit_count）
// - 残数・使用数: view aura_first20_stats（source of truth）
//
// ✅ 原子的な消費は RPC で実行（同時実行でも 21人目が通らない）
// - aura_claim_first20_free(p_email, p_request_id)
// - aura_claim_meish_free(p_email, p_request_id)
//
// ※ 旧: aura_free_claims / rpc aura_sync_first20_count は使用しない

import { supabaseAdmin } from "@/lib/aura/supabaseAdmin";

/**
 * email を正規化（小文字、trim）
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export type ClaimResult = {
  success: boolean;
  reason?: string;
};

type RpcResult = {
  ok?: boolean;
  reason?: string;
  message?: string;
};

/**
 * 先着20名無料を消費する（RPC）
 *
 * - 採用者（entries.confirmed=true）は first20 を使えない
 * - 枠が埋まっていたら limit_reached
 * - 二重消費は already_used
 */
export async function claimFirst20Free(
  email: string,
  requestId?: string | null
): Promise<ClaimResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { success: false, reason: "email_missing" };

  const admin = supabaseAdmin() as any;

  console.log("[claimFirst20Free] RPC START:", {
    email: normalizedEmail,
    requestId: requestId ?? null,
  });

  const { data, error } = await admin.rpc("aura_claim_first20_free", {
    p_email: normalizedEmail,
    p_request_id: requestId ?? null,
  });

  if (error) {
    console.warn("[claimFirst20Free] rpc error:", error);
    return { success: false, reason: `rpc_error:${error.message}` };
  }

  const res = (data ?? {}) as RpcResult;

  if (res.ok === true) {
    console.log("[claimFirst20Free] SUCCESS:", normalizedEmail);
    return { success: true };
  }

  return { success: false, reason: String(res.reason ?? "unknown") };
}

/**
 * me-ish採用無料を消費する（RPC）
 *
 * - entries.confirmed=true の email のみ利用可
 * - 消費時に「first20 を使っていたら返還」も同RPCで実施（converted_to_meish_at）
 */
export async function claimMeishFree(
  email: string,
  requestId?: string | null
): Promise<ClaimResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { success: false, reason: "email_missing" };

  const admin = supabaseAdmin() as any;

  console.log("[claimMeishFree] RPC START:", {
    email: normalizedEmail,
    requestId: requestId ?? null,
  });

  const { data, error } = await admin.rpc("aura_claim_meish_free", {
    p_email: normalizedEmail,
    p_request_id: requestId ?? null,
  });

  if (error) {
    console.warn("[claimMeishFree] rpc error:", error);
    return { success: false, reason: `rpc_error:${error.message}` };
  }

  const res = (data ?? {}) as RpcResult;

  if (res.ok === true) {
    console.log("[claimMeishFree] SUCCESS:", normalizedEmail);
    return { success: true };
  }

  return { success: false, reason: String(res.reason ?? "unknown") };
}

/**
 * 無料判定（消費しない、確認のみ）
 *
 * チェック順:
 * 1) me-ish採用（entries.confirmed=true）かつ meish未使用 → eligible(meish)
 * 2) 非採用者 かつ first20未使用 かつ 残数>0 → eligible(first20)
 * 3) それ以外 → false
 *
 * 返す reason はログ/デバッグ用途（UI文言には直接使わないのが安全）
 */
export async function checkFreeEligibility(
  email: string
): Promise<{
  eligible: boolean;
  reason: string;
  freeType?: "meish" | "first20";
}> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { eligible: false, reason: "email_missing" };

  const admin = supabaseAdmin() as any;

  try {
    // me-ish採用チェック
    const { data: entry, error: entryErr } = await admin
      .from("entries")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("confirmed", true)
      .limit(1)
      .maybeSingle();

    if (entryErr) {
      console.warn("[checkFreeEligibility] entry check error:", entryErr);
      return { eligible: false, reason: "db_error_entry" };
    }

    // meish 使用済み？
    const { data: meishUsed, error: meishErr } = await admin
      .from("aura_meish_free_claims")
      .select("email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (meishErr) {
      console.warn("[checkFreeEligibility] meish claims error:", meishErr);
      return { eligible: false, reason: "db_error_meish_claims" };
    }

    // 1) 採用者は meish を優先（first20に含めない要件）
    if (entry && !meishUsed) {
      return { eligible: true, reason: "meish_free_available", freeType: "meish" };
    }

    // 2) 非採用者のみ first20 判定
    if (!entry) {
      // first20 使用済み（返還されていない）？
      const { data: first20Row, error: first20RowErr } = await admin
        .from("aura_first20_redemptions")
        .select("email, converted_to_meish_at")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (first20RowErr) {
        console.warn("[checkFreeEligibility] first20 row error:", first20RowErr);
        return { eligible: false, reason: "db_error_first20_row" };
      }

      const alreadyUsed = !!(first20Row && !first20Row.converted_to_meish_at);
      if (!alreadyUsed) {
        // 残数（View）
        const { data: stats, error: statsErr } = await admin
          .from("aura_first20_stats")
          .select("remaining")
          .eq("key", "first20")
          .maybeSingle();

        if (statsErr) {
          console.warn("[checkFreeEligibility] stats error:", statsErr);
          return { eligible: false, reason: "db_error_stats" };
        }

        const remaining = Number(stats?.remaining ?? 0);
        if (remaining > 0) {
          return { eligible: true, reason: "first20_free_available", freeType: "first20" };
        }

        return { eligible: false, reason: "first20_limit_reached" };
      }

      return { eligible: false, reason: "first20_already_used" };
    }

    // 3) 採用者だが meish 使用済み / 非対象など
    return { eligible: false, reason: entry ? "meish_already_used" : "no_free_option_available" };
  } catch (e) {
    console.error("[checkFreeEligibility] unexpected error:", e);
    return { eligible: false, reason: "check_error" };
  }
}
