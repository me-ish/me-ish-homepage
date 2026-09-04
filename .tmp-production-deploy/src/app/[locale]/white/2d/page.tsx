'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import { Gallery2DGrid } from '@/components/gallery2d/Gallery2DGrid';
import { Button } from '@/components/ui/button';
import { filterWhiteEntries, type EntryRow, GALLERY_SELECT_COLUMNS } from '@/lib/gallery/galleryUtils';
import { fillWithPlaceholders } from '@/lib/gallery/placeholder';

/** 2Dギャラリーの表示枠数 */
const DISPLAY_SLOTS = 10;

/** クエリ上限 */
const QUERY_LIMIT = 50;

export default function White2DPage() {
  const t = useTranslations('pages.white2d');
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualCount, setActualCount] = useState(0);

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('entries')
        .select(GALLERY_SELECT_COLUMNS)
        .eq('confirmed', true)
        .eq('display_ready', true)
        .eq('gallery_type', 'white')
        .is('display_end_at', null) // 無期限展示のみ
        .order('confirmed_at', { ascending: false })
        .limit(QUERY_LIMIT);

      if (fetchError) {
        console.error('White entries fetch error:', fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        // 追加のフィルタリング（念のため）
        const displayable = filterWhiteEntries(data as unknown as EntryRow[]);

        // 実際の作品数を記録
        setActualCount(displayable.length);

        // プレースホルダーで埋める
        const filled = fillWithPlaceholders(displayable, DISPLAY_SLOTS);
        setEntries(filled);
      }

      setLoading(false);
    };

    fetchEntries();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                White Gallery
                <span className="text-sm font-normal text-gray-500 ml-2">
                  2D View
                </span>
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('subtitle')}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/white">
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
        {/* Collection Info */}
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
            <Link href="/white" className="text-[#00a1e9] hover:underline">
              {t('view3d')}
            </Link>
            {' | '}
            <Link href="/float/2d" className="text-[#00a1e9] hover:underline">
              Float Gallery (2D)
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
