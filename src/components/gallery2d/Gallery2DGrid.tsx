'use client';

import { ArtworkCard } from './ArtworkCard';
import type { EntryRow } from '@/lib/gallery/galleryUtils';

export interface Gallery2DGridProps {
  entries: EntryRow[];
  /** ローディング中かどうか */
  loading?: boolean;
  /** エラーメッセージ */
  error?: string | null;
  /** 空状態のメッセージ */
  emptyMessage?: string;
}

export function Gallery2DGrid({
  entries,
  loading = false,
  error = null,
  emptyMessage = '展示作品がありません',
}: Gallery2DGridProps) {
  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/5] bg-gray-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-red-500 text-lg mb-2">エラーが発生しました</div>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-gray-400 text-lg">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {entries.map((entry) => (
        <ArtworkCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
