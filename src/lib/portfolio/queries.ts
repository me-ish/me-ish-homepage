// src/lib/portfolio/queries.ts

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  LikedEntry,
  EntryWithStatus,
  TemplateContent,
  WorksFilter,
  SortKey,
  PortfolioSettings,
} from "./types";

/* =========================================================
 * A) 公開設定（source of truth: portfolio_settings）
 * ========================================================= */

/**
 * 公開設定を取得（本人用 / マイページの「公開ページを編集」で使用）
 * source of truth: portfolio_settings
 */
export async function getPortfolioSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<PortfolioSettings | null> {
  const { data, error } = await supabase
    .from("portfolio_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getPortfolioSettings] error:", error);
    return null;
  }
  return data as PortfolioSettings | null;
}

/**
 * 公開設定を upsert（本人用）
 * source of truth: portfolio_settings
 */
export async function upsertPortfolioSettings(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<Pick<PortfolioSettings, "is_public" | "works_filter" | "sort_key">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("portfolio_settings")
    .upsert(
      {
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[upsertPortfolioSettings] error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/* =========================================================
 * B) 作品 / いいね / テンプレ
 * ========================================================= */

/**
 * いいねした作品一覧を取得
 */
export async function getLikedEntries(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<LikedEntry[]> {
  const { data, error } = await supabase
    .from("likes")
    .select(
      `
      created_at,
      entry:entries (
        id,
        title,
        image_url,
        likes
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getLikedEntries] error:", error);
    return [];
  }

  return (data ?? [])
    .filter((d: any) => d.entry)
    .map((d: any) => ({
      id: d.entry.id,
      title: d.entry.title,
      image_url: d.entry.image_url,
      likes: d.entry.likes ?? 0,
      liked_at: d.created_at,
    }));
}

/**
 * 出展作品（ステータス付き）を取得
 * user_id または email でマッチ
 */
export async function getEntriesWithStatus(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<EntryWithStatus[]> {
  const selectFields = `
      id,
      title,
      image_url,
      confirmed,
      display_ready,
      display_start_at,
      display_end_at,
      confirmed_at,
      rejected_at,
      reject_reason,
      likes,
      created_at,
      gallery_type,
      edition_total,
      edition_sold,
      price,
      is_sold,
      is_for_sale,
      portfolio_hidden,
      agree_promotion,
      agree_storage,
      display_plan,
      plan_payment_status,
      guarantee_total,
      guarantee_remaining,
      guarantee_period_end,
      entry_processing_jobs (
        status,
        last_error,
        attempts,
        updated_at
      )
    `;

  // まずuser_idで検索
  let { data: entries, error: entriesErr } = await supabase
    .from("entries")
    .select(selectFields)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("updated_at", {
      referencedTable: "entry_processing_jobs",
      ascending: false,
    })
    .limit(1, { referencedTable: "entry_processing_jobs" });

  // user_idで見つからなければemailで検索
  if ((!entries || entries.length === 0) && userEmail) {
    const result = await supabase
      .from("entries")
      .select(selectFields)
      .eq("email", userEmail)
      .order("created_at", { ascending: false })
      .order("updated_at", {
        referencedTable: "entry_processing_jobs",
        ascending: false,
      })
      .limit(1, { referencedTable: "entry_processing_jobs" });
    entries = result.data;
    entriesErr = result.error;
  }

  if (entriesErr) {
    console.error("[getEntriesWithStatus] entries error:", entriesErr);
    return [];
  }

  const entryIds = (entries ?? []).map((e: any) => e.id);

  let statsMap = new Map<number, number>();
  if (entryIds.length > 0) {
    const { data: stats, error: statsErr } = await supabase
      .from("entry_view_stats")
      .select("entry_id, view_count")
      .in("entry_id", entryIds);

    if (statsErr) {
      console.error("[getEntriesWithStatus] stats error:", statsErr);
    } else {
      statsMap = new Map(
        (stats ?? []).map((s: any) => [s.entry_id, s.view_count])
      );
    }
  }

  return (entries ?? []).map((e: any) => {
    const job = e.entry_processing_jobs?.[0];
    return {
      id: e.id,
      title: e.title,
      image_url: e.image_url,
      confirmed: e.confirmed,
      display_ready: e.display_ready,
      display_start_at: e.display_start_at,
      display_end_at: e.display_end_at,
      confirmed_at: e.confirmed_at,
      rejected_at: e.rejected_at,
      reject_reason: e.reject_reason,
      likes: e.likes ?? 0,
      created_at: e.created_at,
      gallery_type: e.gallery_type,
      edition_total: e.edition_total,
      edition_sold: e.edition_sold,
      price: e.price,
      is_sold: e.is_sold,
      is_for_sale: e.is_for_sale,
      portfolio_hidden: e.portfolio_hidden ?? false,
      agree_promotion: e.agree_promotion ?? false,
      agree_storage: e.agree_storage ?? false,
      display_plan: e.display_plan,
      plan_payment_status: e.plan_payment_status,
      guarantee_total: e.guarantee_total ?? null,
      guarantee_remaining: e.guarantee_remaining ?? null,
      guarantee_period_end: e.guarantee_period_end ?? null,
      job_status: job?.status ?? null,
      job_error: job?.last_error ?? null,
      job_attempts: job?.attempts ?? null,
      job_updated_at: job?.updated_at ?? null,
      view_count: statsMap.get(e.id) ?? 0,
    };
  });
}

/**
 * テンプレート版のコンテンツを生成
 */
export async function getTemplateContent(
  supabase: SupabaseClient,
  userId: string
): Promise<TemplateContent> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bio, sns_links")
    .eq("id", userId)
    .maybeSingle();

  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, title, image_url")
    .eq("user_id", userId)
    .eq("display_ready", true)
    .eq("confirmed", true)
    .eq("portfolio_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[getTemplateContent] entries error:", error);
  }

  return {
    profile: {
      display_name: profile?.display_name ?? "Artist",
      avatar_url: profile?.avatar_url ?? null,
      bio: profile?.bio ?? null,
      sns_links: (profile?.sns_links as any) ?? null,
    },
    entries: (entries ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      image_url: e.image_url,
    })),
  };
}

/**
 * ポートフォリオ設定用の作品一覧取得（confirmed=true のみ）
 * NOTE: 設定画面で使う「候補一覧」
 */
export async function getPortfolioEntries(
  supabase: SupabaseClient,
  userId: string
): Promise<EntryWithStatus[]> {
  const { data: entries, error } = await supabase
    .from("entries")
    .select(
      `
      id,
      title,
      image_url,
      confirmed,
      display_ready,
      display_start_at,
      display_end_at,
      confirmed_at,
      likes,
      created_at,
      gallery_type,
      is_for_sale,
      portfolio_hidden
    `
    )
    .eq("user_id", userId)
    .eq("confirmed", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getPortfolioEntries] error:", error);
    return [];
  }

  return (entries ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    image_url: e.image_url,
    confirmed: e.confirmed,
    display_ready: e.display_ready,
    display_start_at: e.display_start_at,
    display_end_at: e.display_end_at,
    confirmed_at: e.confirmed_at,
    likes: e.likes ?? 0,
    created_at: e.created_at,
    gallery_type: e.gallery_type,
    is_for_sale: e.is_for_sale,
    portfolio_hidden: e.portfolio_hidden ?? false,
  }));
}

/**
 * 作品のポートフォリオ表示/非表示を更新
 * ✅ userId を渡せる場合は必ず渡す（IDOR防止）
 */
export async function updateEntryPortfolioHidden(
  supabase: SupabaseClient,
  entryId: number,
  hidden: boolean,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  let q = supabase
    .from("entries")
    .update({ portfolio_hidden: hidden })
    .eq("id", entryId);

  if (userId) q = q.eq("user_id", userId);

  const { error } = await q;
  if (error) {
    console.error("[updateEntryPortfolioHidden] error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * 作品の同意設定を更新（agree_promotion / agree_storage）
 */
export async function updateEntryConsent(
  supabase: SupabaseClient,
  entryId: number,
  fields: { agree_promotion?: boolean; agree_storage?: boolean },
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  let q = supabase
    .from("entries")
    .update(fields)
    .eq("id", entryId);

  if (userId) q = q.eq("user_id", userId);

  const { error } = await q;
  if (error) {
    console.error("[updateEntryConsent] error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/* =========================================================
 * C) プレビュー用プロフィール
 * ========================================================= */

export type UserProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  sns_links: { homepage?: string; twitter?: string; instagram?: string } | null;
};

export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, banner_url, bio, sns_links")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getUserProfile] error:", error);
    return null;
  }
  return data as UserProfile | null;
}

/* =========================================================
 * D) 公開ポートフォリオ用ビュー（v_public_portfolio_entries）
 * ========================================================= */

export type PublicPortfolioEntry = {
  id: number;
  user_id: string;
  created_at: string;
  title: string | null;
  description: string | null;
  image_url: string;
  gallery_type: string | null;
  likes: number;
  is_for_sale: boolean;
  sale_type: string | null;
  price: number | null;
  is_sold: boolean | null;
  edition_total: number | null;
  edition_sold: number | null;
  edition_remaining: number | null;
  sold_out_calc: boolean | null;
  display_ready: boolean;
  display_start_at: string | null;
  display_end_at: string | null;
};

/**
 * 公開ポートフォリオ作品を取得（v_public_portfolio_entries ビュー使用）
 * ビューで既に公開条件（display_ready, portfolio_hidden等）がフィルタ済み
 */
export async function getPublicPortfolioEntries(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    sortKey?: "new" | "likes";
    limit?: number;
  }
): Promise<PublicPortfolioEntry[]> {
  const sortKey = options?.sortKey ?? "new";
  const limit = options?.limit ?? 50;

  let query = supabase
    .from("v_public_portfolio_entries")
    .select("*")
    .eq("user_id", userId);

  if (sortKey === "likes") {
    query = query.order("likes", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[getPublicPortfolioEntries] error:", error);
    return [];
  }

  return (data ?? []).map((e: any) => ({
    id: e.id,
    user_id: e.user_id,
    created_at: e.created_at,
    title: e.title,
    description: e.description,
    image_url: e.image_url,
    gallery_type: e.gallery_type,
    likes: e.likes ?? 0,
    is_for_sale: e.is_for_sale ?? false,
    sale_type: e.sale_type,
    price: e.price,
    is_sold: e.is_sold,
    edition_total: e.edition_total,
    edition_sold: e.edition_sold,
    edition_remaining: e.edition_remaining,
    sold_out_calc: e.sold_out_calc,
    display_ready: e.display_ready ?? false,
    display_start_at: e.display_start_at,
    display_end_at: e.display_end_at,
  }));
}
