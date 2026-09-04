/**
 * Float Gallery Daily Picker
 *
 * seeded shuffle による日替わり展示選定ロジック
 * 同じ日付なら同じ結果を返す
 */

/** 展示枠数（必要に応じて変更可） */
export const FLOAT_DAILY_SLOT_COUNT = 32;

/**
 * 日付文字列からシード値を生成
 * @param dateStr YYYY-MM-DD 形式
 */
function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * seeded pseudo-random number generator (Mulberry32)
 */
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle with seeded random
 */
function seededShuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 日替わり展示を選定する
 *
 * @param candidates display 可能な候補配列
 * @param dateStr YYYY-MM-DD 形式の日付（デフォルトは今日）
 * @param slotCount 展示枠数（デフォルトは FLOAT_DAILY_SLOT_COUNT）
 * @returns 当日展示の上位 N 件
 */
export function pickDailyExhibits<T>(
  candidates: T[],
  dateStr?: string,
  slotCount: number = FLOAT_DAILY_SLOT_COUNT
): T[] {
  if (candidates.length === 0) return [];

  const date = dateStr || getTodayDateString();
  const seed = dateToSeed(date);
  const random = mulberry32(seed);

  const shuffled = seededShuffle(candidates, random);
  return shuffled.slice(0, Math.min(slotCount, shuffled.length));
}

/**
 * 今日の日付を YYYY-MM-DD 形式で取得（JST基準）
 */
export function getTodayDateString(): string {
  const now = new Date();
  // JST = UTC + 9
  const jst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return jst.toISOString().split('T')[0];
}

/**
 * 日付文字列のバリデーション
 */
export function isValidDateString(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}
