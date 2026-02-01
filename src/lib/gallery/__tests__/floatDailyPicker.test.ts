/**
 * Float Gallery Daily Picker テスト
 *
 * 実行: npx vitest run src/lib/gallery/__tests__/floatDailyPicker.test.ts
 * または: npx tsx src/lib/gallery/__tests__/floatDailyPicker.test.ts
 */

import {
  pickDailyExhibits,
  getTodayDateString,
  isValidDateString,
  FLOAT_DAILY_SLOT_COUNT,
} from '../floatDailyPicker';

// テスト用のモックデータ
const mockEntries = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  title: `Artwork ${i + 1}`,
  artist_name: `Artist ${i + 1}`,
  image_url: `/images/artwork-${i + 1}.jpg`,
}));


// Test 1: 同じ日付なら同じ結果
const date1 = '2025-01-30';
const result1a = pickDailyExhibits(mockEntries, date1);
const result1b = pickDailyExhibits(mockEntries, date1);
const isSameResult = JSON.stringify(result1a) === JSON.stringify(result1b);

// Test 2: 異なる日付なら異なる結果
const date2a = '2025-01-30';
const date2b = '2025-01-31';
const result2a = pickDailyExhibits(mockEntries, date2a);
const result2b = pickDailyExhibits(mockEntries, date2b);
const isDifferentResult = JSON.stringify(result2a) !== JSON.stringify(result2b);

// Test 3: スロット数の制限
const result3 = pickDailyExhibits(mockEntries, '2025-01-30', 10);

// Test 4: 候補が少ない場合
const smallEntries = mockEntries.slice(0, 5);
const result4 = pickDailyExhibits(smallEntries, '2025-01-30', 24);

// Test 5: 空配列
const result5 = pickDailyExhibits([], '2025-01-30');

// Test 6: getTodayDateString のフォーマット
const today = getTodayDateString();
const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(today);

// Test 7: isValidDateString
const validCases = [
  { input: '2025-01-30', expected: true },
  { input: '2025-12-31', expected: true },
  { input: '2025-1-30', expected: false },
  { input: '2025/01/30', expected: false },
  { input: 'invalid', expected: false },
  { input: '', expected: false },
];
validCases.forEach(({ input, expected }) => {
  const result = isValidDateString(input);
  const pass = result === expected;
});

// Test 8: 日付ごとの分布確認（全作品が均等に選ばれるか）
const countMap = new Map<number, number>();
for (let day = 1; day <= 30; day++) {
  const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
  const selected = pickDailyExhibits(mockEntries, dateStr, 24);
  selected.forEach(entry => {
    countMap.set(entry.id, (countMap.get(entry.id) || 0) + 1);
  });
}
const counts = Array.from(countMap.values());
const minCount = Math.min(...counts);
const maxCount = Math.max(...counts);
const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

// Test 9: FLOAT_DAILY_SLOT_COUNT の値

// Test 10: 3Dと2Dの選出一致確認
const testDate = '2025-01-30';

// 3D方式: IDでソート後にシャッフル
const sorted3D = [...mockEntries].sort((a, b) => a.id - b.id);
const result3D = pickDailyExhibits(sorted3D, testDate, 24);

// 2D方式（修正後）: 同様にIDでソート後にシャッフル
const sorted2D = [...mockEntries].sort((a, b) => a.id - b.id);
const result2D = pickDailyExhibits(sorted2D, testDate, 24);

const isMatching = JSON.stringify(result3D.map(e => e.id)) === JSON.stringify(result2D.map(e => e.id));

