// src/lib/portfolio/queries.ts

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  PortfolioProfile,
  LikedEntry,
  EntryWithStatus,
  TemplateContent,
  PublicPortfolioData,
  WorksFilter,
  SortKey,
  // ✅ 追加（types.ts に PortfolioSettings を定義してある前提）
  //    まだ無い場合は types.ts に追加してください（user_id / is_public / works_filter / sort_key など）
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
  updates: Partial<
    Pick<PortfolioSettings, "is_public" | "works_filter" | "sort_key">
  >
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
 * B) スラッグ / プロファイル（将来用: portfolio_profiles）
 *   ※ slug運用がまだなら、ここは後で整理してOK
 * ========================================================= */

/**
 * ポートフォリオプロフィールを取得（本人用）
 * NOTE: これは portfolio_profiles を読む。公開ON/OFFの source of truth ではない。
 * （slug / mode など将来用途がある場合のみ使用）
 */
export async function getPortfolioProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PortfolioProfile | null> {
  const { data, error } = await supabase
    .from("portfolio_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getPortfolioProfile] error:", error);
    return null;
  }
  return data as PortfolioProfile | null;
}

/**
 * スラッグで公開ポートフォリオを取得
 * NOTE: slug公開をやる場合の参照。is_public は portfolio_profiles 側の列を前提。
 * （現状は get_public_portfolio RPC を使っているので、ここは未使用でもOK）
 */
export async function getPublicPortfolioBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<PublicPortfolioData | null> {
  const { data, error } = await supabase
    .from("portfolio_profiles")
    .select(
      `
      *,
      profile:profiles (
        display_name,
        avatar_url,
        bio,
        sns_links
      )
    `
    )
    .eq("public_slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (error) {
    console.error("[getPublicPortfolioBySlug] error:", error);
    return null;
  }
  return data as PublicPortfolioData | null;
}

/**
 * スラッグの利用可能チェック
 */
export async function isSlugAvailable(
  supabase: SupabaseClient,
  slug: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabase.from("portfolio_profiles").select("id").eq("public_slug", slug);

  if (excludeUserId) {
    query = query.neq("user_id", excludeUserId);
  }

  const { data } = await query.maybeSingle();
  return !data;
}

/**
 * ポートフォリオプロフィールを upsert（slug等の管理用）
 * NOTE: 公開ON/OFFの source of truth ではない。必要なときだけ使う。
 */
export async function upsertPortfolioProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<Pick<PortfolioProfile, "is_public" | "works_filter" | "sort_key">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("portfolio_profiles")
    .upsert(
      {
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[upsertPortfolioProfile] error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/* =========================================================
 * C) 作品 / いいね / テンプレ
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
 */
export async function getEntriesWithStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<EntryWithStatus[]> {
  // entries + job status（エラー情報も含む）
  const { data: entries, error: entriesErr } = await supabase
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
      edition_total,
      edition_sold,
      price,
      is_sold,
      is_for_sale,
      portfolio_hidden,
      entry_processing_jobs (
        status,
        last_error,
        attempts,
        updated_at
      )
    `
    )
    .eq("user_id", userId)
    // entries自体は新着順
    .order("created_at", { ascending: false })
    // jobsは「最新が先頭」になるように（重要）
    .order("updated_at", {
      referencedTable: "entry_processing_jobs",
      ascending: false,
    })
    // jobsは1件だけで十分（重要）
    .limit(1, { referencedTable: "entry_processing_jobs" });

  if (entriesErr) {
    console.error("[getEntriesWithStatus] entries error:", entriesErr);
    return [];
  }

  // 閲覧数を取得（ビュー経由）
  const entryIds = (entries ?? []).map((e: any) => e.id);

  let statsMap = new Map<number, number>();
  if (entryIds.length > 0) {
    const { data: stats } = await supabase
      .from("entry_view_stats")
      .select("entry_id, view_count")
      .in("entry_id", entryIds);

    statsMap = new Map((stats ?? []).map((s: any) => [s.entry_id, s.view_count]));
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
      likes: e.likes ?? 0,
      created_at: e.created_at,
      gallery_type: e.gallery_type,
      edition_total: e.edition_total,
      edition_sold: e.edition_sold,
      price: e.price,
      is_sold: e.is_sold,
      is_for_sale: e.is_for_sale,
      portfolio_hidden: e.portfolio_hidden ?? false,
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
  // プロフィール
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bio, sns_links")
    .eq("id", userId)
    .maybeSingle();

  // 展示中の作品のみ
  const { data: entries } = await supabase
    .from("entries")
    .select("id, title, image_url")
    .eq("user_id", userId)
    .eq("display_ready", true)
    .eq("confirmed", true)
    .eq("portfolio_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

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
 *
 * 互換のため userId は optional（既存呼び出しを壊さない）
 */
export async function updateEntryPortfolioHidden(
  supabase: SupabaseClient,
  entryId: number,
  hidden: boolean,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  let q = supabase.from("entries").update({ portfolio_hidden: hidden }).eq("id", entryId);
  if (userId) q = q.eq("user_id", userId);

  const { error } = await q;

  if (error) {
    console.error("[updateEntryPortfolioHidden] error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/* =========================================================
 * D) プレビュー用プロフィール
 * ========================================================= */

/**
 * ユーザープロフィールを取得（プレビュー用）
 */
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
