// src/app/mypage/_components/MyWorksTab.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { getEntriesWithStatus } from '@/lib/portfolio/queries';
import { EntryStatusBadge } from './EntryStatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Heart,
  Eye,
  Calendar,
  Loader2,
  Plus,
  ImageIcon,
  ChevronDown,
} from 'lucide-react';
import type { EntryWithStatus } from '@/lib/portfolio/types';

const SORT_OPTIONS = [
  { key: 'new', label: '新着順' },
  { key: 'likes', label: 'いいね順' },
  { key: 'views', label: '閲覧数順' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['key'];

export function MyWorksTab({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<EntryWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('new');

  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);
      try {
        const data = await getEntriesWithStatus(supabase, userId);
        setEntries(data);
      } catch (err) {
        console.error('[MyWorksTab] error:', err);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ソート処理
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (sortKey === 'new') {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortKey === 'likes') {
        return b.likes - a.likes;
      }
      // views
      return (b.view_count ?? 0) - (a.view_count ?? 0);
    });
  }, [entries, sortKey]);

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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          出展作品がありません
        </h3>
        <p className="text-gray-500 mb-6">
          作品を応募してギャラリーに展示しましょう
        </p>
        <Link
          href="/entry"
          className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-5 py-2.5 text-white font-medium hover:brightness-105 transition"
        >
          <Plus className="h-4 w-4" />
          作品を応募
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* コントロール */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{sortedEntries.length}件の作品</p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="appearance-none rounded-lg border px-3 py-2 pr-8 text-sm outline-none hover:bg-gray-50 focus:ring-2 focus:ring-[#00a1e9]/30"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
          <Link
            href="/entry"
            className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-4 py-2 text-white text-sm font-medium hover:brightness-105 transition"
          >
            <Plus className="h-4 w-4" />
            応募
          </Link>
        </div>
      </div>

      {/* テーブル表示 */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[80px]">サムネ</TableHead>
              <TableHead>タイトル</TableHead>
              <TableHead className="w-[100px] text-center">
                ステータス
              </TableHead>
              <TableHead className="w-[80px] text-center hidden sm:table-cell">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-4 w-4 text-pink-500" />
                </span>
              </TableHead>
              <TableHead className="w-[80px] text-center hidden sm:table-cell">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4 text-gray-400" />
                </span>
              </TableHead>
              <TableHead className="w-[180px] hidden md:table-cell">
                展示期間
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EntryRow({ entry }: { entry: EntryWithStatus }) {
  const imageUrl = entry.image_url || '/placeholder.png';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
    });
  };

  const displayPeriod = entry.display_start_at
    ? `${formatDate(entry.display_start_at)} 〜 ${entry.display_end_at ? formatDate(entry.display_end_at) : '無期限'}`
    : '—';

  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="p-2">
        <Link href={`/works/${entry.id}`} className="block">
          <div className="relative w-14 h-14 rounded-md overflow-hidden bg-gray-100">
            <Image
              src={imageUrl}
              alt={entry.title || 'Artwork'}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/works/${entry.id}`}
          className="font-medium text-gray-900 hover:text-[#00a1e9] line-clamp-1"
        >
          {entry.title || 'Untitled'}
        </Link>
        {entry.gallery_type && (
          <Badge variant="outline" className="ml-2 text-xs">
            {entry.gallery_type === 'float' ? 'Float' : 'White'}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        <EntryStatusBadge entry={entry} />
      </TableCell>
      <TableCell className="text-center hidden sm:table-cell">
        <span className="text-sm text-gray-600">{entry.likes}</span>
      </TableCell>
      <TableCell className="text-center hidden sm:table-cell">
        <span className="text-sm text-gray-600">{entry.view_count ?? 0}</span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="inline-flex items-center gap-1 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          {displayPeriod}
        </span>
      </TableCell>
    </TableRow>
  );
}
