/**
 * Gallery Utilities
 *
 * 2D/3D ギャラリー共通のユーティリティ関数
 */

import type { Database } from '@/types/supabase';

export type EntryRow = Database['public']['Tables']['entries']['Row'];

/**
 * ギャラリー表示に必要なカラムのみ選択
 * パフォーマンス最適化のため、select('*') の代わりに使用
 */
export const GALLERY_SELECT_COLUMNS = `
  id,
  title,
  artist_name,
  image_url,
  file_name,
  likes,
  price,
  edition_total,
  edition_sold,
  is_sold,
  is_for_sale,
  confirmed,
  display_ready,
  display_end_at,
  confirmed_at
`.replace(/\s+/g, '');

/**
 * 画像URLを解決する
 * 1. image_url が存在すればそれを使用
 * 2. なければ file_name から Storage の公開URLを生成
 */
export function resolveImageUrl(entry: Pick<EntryRow, 'image_url' | 'file_name'>): string {
  // Priority 1: Direct image_url
  const direct = entry.image_url?.trim();
  if (direct) return direct;

  // Priority 2: Generate from file_name
  const raw = (entry.file_name ?? '').trim();
  if (!raw) return '';

  // Convert to .png and build public URL
  const pngName = raw.replace(/\.(?:jpe?g|png|webp|gif|avif|tiff)$/i, '.png');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${supabaseUrl}/storage/v1/object/public/artworks/final/${pngName}`;
}

/**
 * 価格をフォーマットする（日本円）
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return '';
  return `¥${price.toLocaleString('ja-JP')}`;
}

/**
 * エディション情報をフォーマットする
 */
export function formatEdition(
  total: number | null | undefined,
  sold: number | null | undefined
): string | null {
  if (total == null || total === 0) return null;
  const remaining = total - (sold ?? 0);
  return `${remaining}/${total}`;
}

/**
 * SNSリンクをパースする
 */
export function parseSnsLinks(snsLinks: string): Record<string, string> {
  if (!snsLinks) return {};
  try {
    return JSON.parse(snsLinks);
  } catch {
    return {};
  }
}

/**
 * SOLD状態を判定する
 */
export function isSoldOut(entry: Pick<EntryRow, 'is_sold' | 'edition_total' | 'edition_sold'>): boolean {
  // is_sold フラグで即判定
  if (entry.is_sold === true) return true;

  // エディション売り切れ判定
  if (entry.edition_total != null && entry.edition_total > 0) {
    const remaining = entry.edition_total - (entry.edition_sold ?? 0);
    return remaining <= 0;
  }

  return false;
}

/**
 * エントリが有効な表示対象かどうか判定する
 */
export function isDisplayable(entry: Pick<EntryRow, 'confirmed' | 'display_ready'>): boolean {
  return entry.confirmed === true && entry.display_ready === true;
}

/**
 * White Gallery 用: display_end_at が null（無期限）のエントリをフィルタ
 */
export function filterWhiteEntries(entries: EntryRow[]): EntryRow[] {
  return entries.filter(
    (e) => isDisplayable(e) && e.display_end_at == null
  );
}

/**
 * Float Gallery 用: display可能なエントリをフィルタ
 */
export function filterFloatEntries(entries: EntryRow[]): EntryRow[] {
  const now = Date.now();
  return entries.filter((e) => {
    if (!isDisplayable(e)) return false;
    if (!e.display_end_at) return true;
    return new Date(e.display_end_at).getTime() > now;
  });
}
