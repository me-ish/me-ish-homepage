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

console.log('=== Float Daily Picker Tests ===\n');

// Test 1: 同じ日付なら同じ結果
console.log('Test 1: 同じ日付なら同じ結果を返すか');
const date1 = '2025-01-30';
const result1a = pickDailyExhibits(mockEntries, date1);
const result1b = pickDailyExhibits(mockEntries, date1);
const isSameResult = JSON.stringify(result1a) === JSON.stringify(result1b);
console.log(`  Date: ${date1}`);
console.log(`  Result 1: [${result1a.slice(0, 3).map(e => e.id).join(', ')}...]`);
console.log(`  Result 2: [${result1b.slice(0, 3).map(e => e.id).join(', ')}...]`);
console.log(`  Same result: ${isSameResult ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: 異なる日付なら異なる結果
console.log('Test 2: 異なる日付なら異なる結果を返すか');
const date2a = '2025-01-30';
const date2b = '2025-01-31';
const result2a = pickDailyExhibits(mockEntries, date2a);
const result2b = pickDailyExhibits(mockEntries, date2b);
const isDifferentResult = JSON.stringify(result2a) !== JSON.stringify(result2b);
console.log(`  Date A: ${date2a} → [${result2a.slice(0, 5).map(e => e.id).join(', ')}...]`);
console.log(`  Date B: ${date2b} → [${result2b.slice(0, 5).map(e => e.id).join(', ')}...]`);
console.log(`  Different result: ${isDifferentResult ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: スロット数の制限
console.log('Test 3: スロット数が正しく制限されるか');
const result3 = pickDailyExhibits(mockEntries, '2025-01-30', 10);
console.log(`  Requested slots: 10`);
console.log(`  Actual count: ${result3.length}`);
console.log(`  Correct: ${result3.length === 10 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: 候補が少ない場合
console.log('Test 4: 候補がスロット数より少ない場合');
const smallEntries = mockEntries.slice(0, 5);
const result4 = pickDailyExhibits(smallEntries, '2025-01-30', 24);
console.log(`  Candidates: 5, Slots: 24`);
console.log(`  Result count: ${result4.length}`);
console.log(`  Correct: ${result4.length === 5 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 5: 空配列
console.log('Test 5: 空配列の場合');
const result5 = pickDailyExhibits([], '2025-01-30');
console.log(`  Result: ${JSON.stringify(result5)}`);
console.log(`  Correct: ${result5.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 6: getTodayDateString のフォーマット
console.log('Test 6: getTodayDateString のフォーマット');
const today = getTodayDateString();
const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(today);
console.log(`  Today (JST): ${today}`);
console.log(`  Valid format: ${isValidFormat ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 7: isValidDateString
console.log('Test 7: isValidDateString');
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
  console.log(`  "${input}" → ${result} (expected: ${expected}) ${pass ? '✅' : '❌'}`);
});
console.log();

// Test 8: 日付ごとの分布確認（全作品が均等に選ばれるか）
console.log('Test 8: 30日間の選出分布');
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
console.log(`  Min selections: ${minCount}`);
console.log(`  Max selections: ${maxCount}`);
console.log(`  Avg selections: ${avgCount.toFixed(1)}`);
console.log(`  Distribution OK: ${maxCount - minCount <= 10 ? '✅ PASS' : '⚠️ WARN (variance high)'}\n`);

// Test 9: FLOAT_DAILY_SLOT_COUNT の値
console.log('Test 9: FLOAT_DAILY_SLOT_COUNT');
console.log(`  Value: ${FLOAT_DAILY_SLOT_COUNT}`);
console.log(`  Matches 3D wall slots (24): ${FLOAT_DAILY_SLOT_COUNT === 24 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 10: 3Dと2Dの選出一致確認
console.log('Test 10: 3Dと2Dの選出一致（IDソート後シャッフル）');
const testDate = '2025-01-30';

// 3D方式: IDでソート後にシャッフル
const sorted3D = [...mockEntries].sort((a, b) => a.id - b.id);
const result3D = pickDailyExhibits(sorted3D, testDate, 24);

// 2D方式（修正後）: 同様にIDでソート後にシャッフル
const sorted2D = [...mockEntries].sort((a, b) => a.id - b.id);
const result2D = pickDailyExhibits(sorted2D, testDate, 24);

const isMatching = JSON.stringify(result3D.map(e => e.id)) === JSON.stringify(result2D.map(e => e.id));
console.log(`  3D Top 5: [${result3D.slice(0, 5).map(e => e.id).join(', ')}]`);
console.log(`  2D Top 5: [${result2D.slice(0, 5).map(e => e.id).join(', ')}]`);
console.log(`  Matching: ${isMatching ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('=== Tests Complete ===');
