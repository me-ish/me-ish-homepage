// src/lib/portfolio/queries.ts

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  PortfolioProfile,
  LikedEntry,
  EntryWithStatus,
  TemplateContent,
  PublicPortfolioData
} from './types';

/**
 * ポートフォリオ設定を取得（本人用）
 */
export async function getPortfolioProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PortfolioProfile | null> {
  const { data, error } = await supabase
    .from('portfolio_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[getPortfolioProfile] error:', error);
    return null;
  }
  return data;
}

/**
 * スラッグで公開ポートフォリオを取得
 */
export async function getPublicPortfolioBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<PublicPortfolioData | null> {
  const { data, error } = await supabase
    .from('portfolio_profiles')
    .select(`
      *,
      profile:profiles (
        display_name,
        avatar_url,
        bio,
        sns_links
      )
    `)
    .eq('public_slug', slug)
    .eq('is_public', true)
    .maybeSingle();

  if (error) {
    console.error('[getPublicPortfolioBySlug] error:', error);
    return null;
  }
  return data as PublicPortfolioData | null;
}

/**
 * いいねした作品一覧を取得
 */
export async function getLikedEntries(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<LikedEntry[]> {
  const { data, error } = await supabase
    .from('likes')
    .select(`
      created_at,
      entry:entries (
        id,
        title,
        image_url,
        likes
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getLikedEntries] error:', error);
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
    .from('entries')
    .select(`
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
      entry_processing_jobs (
        status,
        last_error,
        attempts,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (entriesErr) {
    console.error('[getEntriesWithStatus] entries error:', entriesErr);
    return [];
  }

  // 閲覧数を取得（ビュー経由）
  const entryIds = (entries ?? []).map((e: any) => e.id);

  let statsMap = new Map<number, number>();
  if (entryIds.length > 0) {
    const { data: stats } = await supabase
      .from('entry_view_stats')
      .select('entry_id, view_count')
      .in('entry_id', entryIds);

    statsMap = new Map(
      (stats ?? []).map((s: any) => [s.entry_id, s.view_count])
    );
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
    .from('profiles')
    .select('display_name, avatar_url, bio, sns_links')
    .eq('id', userId)
    .maybeSingle();

  // 展示中の作品のみ
  const { data: entries } = await supabase
    .from('entries')
    .select('id, title, image_url')
    .eq('user_id', userId)
    .eq('display_ready', true)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    profile: {
      display_name: profile?.display_name ?? 'Artist',
      avatar_url: profile?.avatar_url ?? null,
      bio: profile?.bio ?? null,
      sns_links: profile?.sns_links as any ?? null,
    },
    entries: (entries ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      image_url: e.image_url,
    })),
  };
}

/**
 * スラッグの利用可能チェック
 */
export async function isSlugAvailable(
  supabase: SupabaseClient,
  slug: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabase
    .from('portfolio_profiles')
    .select('id')
    .eq('public_slug', slug);

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data } = await query.maybeSingle();
  return !data;
}
