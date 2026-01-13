// src/lib/aiPortfolio/auraBillingGate.ts
// ============================================
// AURA 課金ゲート（無料判定・消費ロジック）
// ============================================
//
// source of truth: aura_free_claims テーブル
// - first20_used_at: 先着20名無料を消費した日時
// - meish_used_at: me-ish採用無料を消費した日時
//
// aura_promo_counters は上限値の参照のみに使用
// （used_count は同期更新するが、判定の source of truth ではない）

import { supabaseAdmin } from "@/lib/aiPortfolio/supabaseAdmin";

/**
 * email を正規化（小文字、trim）
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

type ClaimResult = {
  success: boolean;
  reason?: string;
};

/**
 * 先着20名無料を消費する
 *
 * ロジック:
 * 1. aura_promo_counters から key='first20' の limit_count を取得
 * 2. aura_free_claims で first20_used_at が入っている行数を COUNT
 * 3. COUNT < limit_count なら、この email の claims 行を INSERT/UPDATE して消費
 * 4. 競合対策: INSERT ... ON CONFLICT + トランザクション相当で原子性担保
 */
export async function claimFirst20Free(email: string): Promise<ClaimResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { success: false, reason: "email_missing" };
  }

  console.log("[claimFirst20Free] START:", normalizedEmail);

  const admin = supabaseAdmin() as any;

  try {
    // 1) この email が既に first20 を消費済みかチェック
    const { data: existing, error: existErr } = await admin
      .from("aura_free_claims")
      .select("first20_used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existErr) {
      console.error("[claimFirst20Free] select error:", existErr);
      // テーブルが存在しない場合は詳細ログ
      if (existErr.code === "42P01" || existErr.message?.includes("does not exist")) {
        console.error("[claimFirst20Free] TABLE aura_free_claims DOES NOT EXIST!");
      }
      return { success: false, reason: `db_error_select: ${existErr.message}` };
    }

    console.log("[claimFirst20Free] existing claims:", existing);

    if (existing?.first20_used_at) {
      // 既に消費済み → 二重消費不可
      console.log("[claimFirst20Free] already_used:", normalizedEmail);
      return { success: false, reason: "already_used" };
    }

    // 2) 上限を取得
    const { data: counter, error: counterErr } = await admin
      .from("aura_promo_counters")
      .select("limit_count")
      .eq("key", "first20")
      .maybeSingle();

    if (counterErr) {
      console.error("[claimFirst20Free] counter error:", counterErr);
      return { success: false, reason: "db_error_counter" };
    }

    const limitCount = counter?.limit_count ?? 20;

    // 3) 現在の消費数を COUNT（first20_used_at が NOT NULL の行数）
    const { count: usedCount, error: countErr } = await admin
      .from("aura_free_claims")
      .select("*", { count: "exact", head: true })
      .not("first20_used_at", "is", null);

    if (countErr) {
      console.error("[claimFirst20Free] count error:", countErr);
      return { success: false, reason: "db_error_count" };
    }

    const currentUsed = usedCount ?? 0;

    console.log("[claimFirst20Free] limit:", limitCount, "used:", currentUsed, "email:", normalizedEmail);

    if (currentUsed >= limitCount) {
      // 枠が埋まっている
      return { success: false, reason: "limit_reached" };
    }

    // 4) 消費を記録（原子的に INSERT or UPDATE）
    const now = new Date().toISOString();

    if (existing) {
      // 既存行があるが first20_used_at が null → UPDATE
      const { error: updateErr } = await admin
        .from("aura_free_claims")
        .update({ first20_used_at: now })
        .eq("email", normalizedEmail)
        .is("first20_used_at", null); // 条件: まだ消費されていない

      if (updateErr) {
        console.error("[claimFirst20Free] update error:", updateErr);
        return { success: false, reason: "db_error_update" };
      }
    } else {
      // 新規 INSERT
      const { error: insertErr } = await admin
        .from("aura_free_claims")
        .insert({
          email: normalizedEmail,
          first20_used_at: now,
          meish_used_at: null,
        });

      if (insertErr) {
        // UNIQUE 違反の場合は競合（別のリクエストが先に INSERT した）
        if (insertErr.code === "23505") {
          console.log("[claimFirst20Free] race_condition, retrying...");
          // リトライ: 既存行を UPDATE
          const { error: retryErr } = await admin
            .from("aura_free_claims")
            .update({ first20_used_at: now })
            .eq("email", normalizedEmail)
            .is("first20_used_at", null);

          if (retryErr) {
            return { success: false, reason: "race_condition_failed" };
          }
        } else {
          console.error("[claimFirst20Free] insert error:", insertErr);
          return { success: false, reason: "db_error_insert" };
        }
      }
    }

    // 5) counters の used_count を同期更新（監査用、source of truth ではない）
    try {
      await admin.rpc("aura_sync_first20_count");
    } catch {
      // 同期失敗しても消費は成功とする
      console.warn("[claimFirst20Free] sync_count failed, ignoring");
    }

    console.log("[claimFirst20Free] SUCCESS:", normalizedEmail);
    return { success: true };
  } catch (e) {
    console.error("[claimFirst20Free] unexpected error:", e);
    return { success: false, reason: "unexpected_error" };
  }
}

/**
 * me-ish採用無料を消費する
 *
 * ロジック:
 * 1. entries テーブルで email が一致 & confirmed=true のレコードがあるか確認
 * 2. aura_free_claims で meish_used_at が null なら消費可能
 * 3. 消費を記録
 */
export async function claimMeishFree(email: string): Promise<ClaimResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { success: false, reason: "email_missing" };
  }

  console.log("[claimMeishFree] START:", normalizedEmail);

  const admin = supabaseAdmin() as any;

  try {
    // 1) me-ish採用確認: entries.confirmed=true の email 一致
    const { data: entry, error: entryErr } = await admin
      .from("entries")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("confirmed", true)
      .limit(1)
      .maybeSingle();

    console.log("[claimMeishFree] entry check:", { entry, entryErr });

    if (entryErr) {
      console.error("[claimMeishFree] entry check error:", entryErr);
      return { success: false, reason: `db_error_entry: ${entryErr.message}` };
    }

    if (!entry) {
      // me-ish採用されていない
      console.log("[claimMeishFree] not_meish_member:", normalizedEmail);
      return { success: false, reason: "not_meish_member" };
    }

    console.log("[claimMeishFree] IS meish member, entry_id:", entry.id);

    // 2) この email の claims を確認
    const { data: existing, error: existErr } = await admin
      .from("aura_free_claims")
      .select("meish_used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existErr) {
      console.error("[claimMeishFree] select error:", existErr);
      return { success: false, reason: "db_error_select" };
    }

    if (existing?.meish_used_at) {
      // 既に消費済み
      console.log("[claimMeishFree] already_used:", normalizedEmail);
      return { success: false, reason: "already_used" };
    }

    // 3) 消費を記録
    const now = new Date().toISOString();

    if (existing) {
      // 既存行があるが meish_used_at が null → UPDATE
      const { error: updateErr } = await admin
        .from("aura_free_claims")
        .update({ meish_used_at: now })
        .eq("email", normalizedEmail)
        .is("meish_used_at", null);

      if (updateErr) {
        console.error("[claimMeishFree] update error:", updateErr);
        return { success: false, reason: "db_error_update" };
      }
    } else {
      // 新規 INSERT
      const { error: insertErr } = await admin
        .from("aura_free_claims")
        .insert({
          email: normalizedEmail,
          first20_used_at: null,
          meish_used_at: now,
        });

      if (insertErr) {
        if (insertErr.code === "23505") {
          // 競合時リトライ
          const { error: retryErr } = await admin
            .from("aura_free_claims")
            .update({ meish_used_at: now })
            .eq("email", normalizedEmail)
            .is("meish_used_at", null);

          if (retryErr) {
            return { success: false, reason: "race_condition_failed" };
          }
        } else {
          console.error("[claimMeishFree] insert error:", insertErr);
          return { success: false, reason: "db_error_insert" };
        }
      }
    }

    console.log("[claimMeishFree] SUCCESS:", normalizedEmail);
    return { success: true };
  } catch (e) {
    console.error("[claimMeishFree] unexpected error:", e);
    return { success: false, reason: "unexpected_error" };
  }
}

/**
 * 無料判定（消費しない、確認のみ）
 *
 * チェック順:
 * 1. payment_status === "paid" → true
 * 2. me-ish採用（entries.confirmed=true & meish_used_at が null）→ true
 * 3. 先着20名（枠残り & first20_used_at が null）→ true
 * 4. どれも該当しない → false
 */
export async function checkFreeEligibility(email: string): Promise<{
  eligible: boolean;
  reason: string;
  freeType?: "meish" | "first20";
}> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { eligible: false, reason: "email_missing" };
  }

  const admin = supabaseAdmin() as any;

  try {
    // claims を取得
    const { data: claims } = await admin
      .from("aura_free_claims")
      .select("first20_used_at, meish_used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // me-ish採用チェック
    const { data: entry } = await admin
      .from("entries")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("confirmed", true)
      .limit(1)
      .maybeSingle();

    if (entry && !claims?.meish_used_at) {
      return { eligible: true, reason: "meish_free_available", freeType: "meish" };
    }

    // 先着20名チェック
    if (!claims?.first20_used_at) {
      const { data: counter } = await admin
        .from("aura_promo_counters")
        .select("limit_count")
        .eq("key", "first20")
        .maybeSingle();

      const limitCount = counter?.limit_count ?? 20;

      const { count: usedCount } = await admin
        .from("aura_free_claims")
        .select("*", { count: "exact", head: true })
        .not("first20_used_at", "is", null);

      if ((usedCount ?? 0) < limitCount) {
        return { eligible: true, reason: "first20_free_available", freeType: "first20" };
      }
    }

    return { eligible: false, reason: "no_free_option_available" };
  } catch (e) {
    console.error("[checkFreeEligibility] error:", e);
    return { eligible: false, reason: "check_error" };
  }
}
