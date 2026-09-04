'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import { Gallery2DGrid } from '@/components/gallery2d/Gallery2DGrid';
import { Button } from '@/components/ui/button';
import {
  pickDailyExhibits,
  getTodayDateString,
  isValidDateString,
  FLOAT_DAILY_SLOT_COUNT,
} from '@/lib/gallery/floatDailyPicker';
import { filterFloatEntries, type EntryRow, GALLERY_SELECT_COLUMNS } from '@/lib/gallery/galleryUtils';
import { fillWithPlaceholders } from '@/lib/gallery/placeholder';

/** 2Dギャラリーの表示枠数 */
const DISPLAY_SLOTS = 32;

/** クエリ上限（日替わりシャッフルの候補数） */
const QUERY_LIMIT = 200;

export default function Float2DPage() {
  const t = useTranslations('pages.float2d');
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualCount, setActualCount] = useState(0);

  // 日付パラメータの取得（無効な場合は今日の日付）
  const dateParam = searchParams.get('date');
  const displayDate =
    dateParam && isValidDateString(dateParam) ? dateParam : getTodayDateString();
  const isToday = displayDate === getTodayDateString();

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      setError(null);

      const { data: slotData, error: slotErr } = await supabase
        .from('entry_daily_slots')
        .select(`slot_index, entry:entries (${GALLERY_SELECT_COLUMNS})`)
        .eq('display_date', displayDate)
        .order('slot_index', { ascending: true });

      if (!slotErr && slotData && slotData.length > 0) {
        const daily = filterFloatEntries(
          slotData.map((d: any) => d.entry).filter(Boolean) as EntryRow[]
        );
        setActualCount(daily.length);
        const filled = fillWithPlaceholders(daily, DISPLAY_SLOTS);
        setEntries(filled);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('entries')
        .select(GALLERY_SELECT_COLUMNS)
        .eq('confirmed', true)
        .eq('display_ready', true)
        .eq('gallery_type', 'float')
        .order('confirmed_at', { ascending: false })
        .limit(QUERY_LIMIT);

      if (fetchError) {
        console.error('Float entries fetch error:', fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        // フィルタリングして日替わり選定
        // 3D版と同じ結果になるよう、IDでソートしてからシャッフル
        const displayable = filterFloatEntries(data as unknown as EntryRow[]);
        const sorted = [...displayable].sort((a, b) => a.id - b.id);
        const dailyPicks = pickDailyExhibits(sorted, displayDate, FLOAT_DAILY_SLOT_COUNT);

        // 実際の作品数を記録
        setActualCount(dailyPicks.length);

        // プレースホルダーで埋める
        const filled = fillWithPlaceholders(dailyPicks, DISPLAY_SLOTS);
        setEntries(filled);
      }

      setLoading(false);
    };

    fetchEntries();
  }, [displayDate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Float Gallery
                <span className="text-sm font-normal text-gray-500 ml-2">
                  2D View
                </span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {isToday ? t('today') : t('dateExhibition', { date: displayDate })}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/float">
                <Button variant="outline" size="sm">
                  3D View
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Date Info */}
        {!isToday && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              {t('viewingDate', { date: displayDate })}
              <Link
                href="/float/2d"
                className="ml-2 underline hover:no-underline"
              >
                {t('viewToday')}
              </Link>
            </p>
          </div>
        )}

        {/* Exhibition Info */}
        <div className="mb-6 text-sm text-gray-600">
          <p>
            {t('collectionInfo')}
            {actualCount > 0 ? (
              <span className="ml-1">
                {t('worksCount', { count: actualCount })}
              </span>
            ) : (
              <span className="ml-1">
                {t('recruiting')}
              </span>
            )}
          </p>
        </div>

        {/* Gallery Grid */}
        <Gallery2DGrid
          entries={entries}
          loading={loading}
          error={error}
          emptyMessage={t('emptyMessage')}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>
            <Link href="/float" className="text-[#00a1e9] hover:underline">
              {t('view3d')}
            </Link>
            {' | '}
            <Link href="/white/2d" className="text-[#00a1e9] hover:underline">
              White Gallery (2D)
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
