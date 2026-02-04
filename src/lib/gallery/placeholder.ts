/**
 * Placeholder entries for 2D Gallery
 *
 * 作品が足りない場合に表示する仮置き枠
 */

import type { EntryRow } from './galleryUtils';

/** プレースホルダー用の特別なID（負の値で識別） */
export const PLACEHOLDER_ID_START = -1000;

/**
 * プレースホルダーかどうか判定
 */
export function isPlaceholder(entry: { id: number }): boolean {
  return entry.id <= PLACEHOLDER_ID_START;
}

/**
 * プレースホルダーエントリを生成
 * 実データと混ぜて使う
 */
export function generatePlaceholders(count: number): EntryRow[] {
  const placeholders: EntryRow[] = [];

  for (let i = 0; i < count; i++) {
    placeholders.push({
      id: PLACEHOLDER_ID_START - i,
      title: null,
      artist_name: null,
      description: '',
      image_url: '', // 空にして Coming Soon 表示
      file_name: null,
      is_for_sale: false,
      is_sold: null,
      price: null,
      edition_total: null,
      edition_sold: 0,
      edition_remaining: null,
      confirmed: true,
      confirmed_at: null,
      display_ready: true,
      display_end_at: null,
      display_start_at: null,
      display_plan: null,
      gallery_type: 'float',
      sns_links: '',
      created_at: new Date().toISOString(),
      email: null,
      user_id: null,
      external_user_id: null,
      token_id: null,
      type: null,
      sale_type: 'original',
      likes: 0,
      artist_reward_yen: null,
      meish_fee_yen: null,
      paid_at: null,
      plan_payment_amount_yen: null,
      plan_payment_checkout_created_at: null,
      plan_payment_paid_at: null,
      plan_payment_session_id: null,
      plan_payment_status: 'unneeded',
      is_paid_to_artist: null,
      reject_reason: null,
      rejected_at: null,
      reject_email_sent_at: null,
      sold_out_calc: null,
    } as EntryRow);
  }

  return placeholders;
}

/**
 * 実データとプレースホルダーを合わせて指定数にする
 */
export function fillWithPlaceholders(
  entries: EntryRow[],
  totalSlots: number
): EntryRow[] {
  if (entries.length >= totalSlots) {
    return entries.slice(0, totalSlots);
  }

  const needed = totalSlots - entries.length;
  const placeholders = generatePlaceholders(needed);

  return [...entries, ...placeholders];
}
