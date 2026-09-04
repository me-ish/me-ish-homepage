// src/app/mypage/_components/LikedWorksTab.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heart, Loader2 } from 'lucide-react';
import type { LikedEntry } from '@/lib/portfolio/types';

const SORT_OPTIONS = [
  { key: 'liked_at', label: 'いいね順（新しい順）' },
  { key: 'created_at', label: '作品の新着順' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['key'];

// 拡張型（entry_created_at を含む）
type LikedEntryWithDate = LikedEntry & { entry_created_at?: string };

export function LikedWorksTab({ userId }: { userId: string }) {
  const [likedEntries, setLikedEntries] = useState<LikedEntryWithDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('liked_at');

  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('likes')
          .select(
            `
            created_at,
            entry:entries (
              id,
              title,
              image_url,
              artist_name,
              likes,
              created_at,
              confirmed,
              display_ready
            )
          `
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('[LikedWorksTab] error:', error);
          setLikedEntries([]);
          return;
        }

        const entries: LikedEntryWithDate[] = (data ?? [])
          .filter((d: any) => d.entry?.confirmed === true && d.entry?.display_ready === true)
          .map((d: any) => ({
            id: d.entry.id,
            title: d.entry.title,
            image_url: d.entry.image_url,
            artist_name: d.entry.artist_name ?? undefined,
            likes: d.entry.likes ?? 0,
            liked_at: d.created_at,
            entry_created_at: d.entry.created_at,
          }));

        setLikedEntries(entries);
      } catch (err) {
        console.error('[LikedWorksTab] fatal:', err);
        setLikedEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ソート処理
  const sortedEntries = useMemo(() => {
    return [...likedEntries].sort((a, b) => {
      if (sortKey === 'liked_at') {
        return new Date(b.liked_at).getTime() - new Date(a.liked_at).getTime();
      }
      // created_at
      const aDate = a.entry_created_at ?? a.liked_at;
      const bDate = b.entry_created_at ?? b.liked_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [likedEntries, sortKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-50 mb-4">
          <Heart className="h-8 w-8 text-pink-300" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          いいねした作品がありません
        </h3>
        <p className="text-gray-500 mb-6">
          ギャラリーで気になる作品を見つけたら
          <br />
          ハートマークをタップしていいねしましょう
        </p>
        <Link
          href="/galleries/forest"
          className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-5 py-2.5 text-white font-medium hover:brightness-105 transition"
        >
          ギャラリーを見る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 並び替えコントロール */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {sortedEntries.length}件の作品にいいねしています
        </p>
        <Select value={sortKey} onValueChange={(v: string) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="並び替え" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* グリッド表示 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedEntries.map((entry) => (
          <LikedEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function LikedEntryCard({ entry }: { entry: LikedEntry }) {
  const imageUrl = entry.image_url || '/placeholder.png';

  return (
    <Link href={`/works/${entry.id}`} className="block group">
      <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-square bg-gray-100">
          <Image
            src={imageUrl}
            alt={entry.title || 'Artwork'}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {/* いいね数バッジ */}
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-1 text-xs text-white">
            <Heart className="h-3 w-3 fill-current text-pink-400" />
            <span>{entry.likes}</span>
          </div>
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium text-sm line-clamp-1 text-gray-900">
            {entry.title || 'Untitled'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {entry.artist_name || 'Unknown Artist'}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
