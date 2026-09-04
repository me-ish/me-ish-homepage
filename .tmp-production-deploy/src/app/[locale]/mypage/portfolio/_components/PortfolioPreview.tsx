// src/app/mypage/portfolio/_components/PortfolioPreview.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Eye, EyeOff, Globe } from 'lucide-react';
import type { EntryWithStatus, WorksFilter, SortKey } from '@/lib/portfolio/types';
import type { UserProfile } from '@/lib/portfolio/queries';

type Props = {
  profile: UserProfile | null;
  entries: EntryWithStatus[];
  worksFilter: WorksFilter;
  sortKey: SortKey;
  isPublic: boolean;
  publicUrl: string;
};

export function PortfolioPreview({
  profile,
  entries,
  worksFilter,
  sortKey,
  isPublic,
  publicUrl,
}: Props) {
  // フィルタリング（works_filter + portfolio_hidden）
  const filteredEntries = entries
    .filter((e) => {
      // 非表示の作品を除外
      if (e.portfolio_hidden) return false;
      // フィルタ条件
      if (worksFilter === 'displaying') return e.display_ready;
      if (worksFilter === 'for_sale') return e.is_for_sale;
      return true; // 'all'
    })
    .sort((a, b) => {
      // ソート
      if (sortKey === 'likes') return (b.likes ?? 0) - (a.likes ?? 0);
      // 'new' = 新着順
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="relative">
      {/* プレビューバッジ */}
      <div className="absolute top-3 left-3 z-10">
        <Badge
          variant="outline"
          className="bg-white/90 backdrop-blur border-gray-300 text-gray-700 text-xs font-medium"
        >
          <Eye className="h-3 w-3 mr-1" />
          プレビュー
        </Badge>
      </div>

      {/* 公開状態表示 */}
      <div className="absolute top-3 right-3 z-10">
        {isPublic ? (
          <Badge className="bg-emerald-500 text-white text-xs">
            <Globe className="h-3 w-3 mr-1" />
            公開中
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">
            <EyeOff className="h-3 w-3 mr-1" />
            非公開
          </Badge>
        )}
      </div>

      {/* プレビューコンテナ */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-white">
        {/* バナー */}
        <div className="relative h-32 md:h-40 w-full overflow-hidden">
          {profile?.banner_url ? (
            <Image
              src={profile.banner_url}
              alt="banner"
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-sky-50 to-indigo-50" />
          )}
        </div>

        {/* プロフィールエリア */}
        <div className="relative px-4 pb-4">
          {/* アバター */}
          <div className="absolute -top-10 left-4">
            <div className="relative w-20 h-20 rounded-full ring-4 ring-white overflow-hidden bg-gray-100">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name || 'Artist'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-gray-400 text-2xl">
                  👤
                </div>
              )}
            </div>
          </div>

          {/* 名前・bio */}
          <div className="pt-12 space-y-2">
            <h2 className="font-bold text-lg text-gray-900">
              {profile?.display_name || 'Artist'}
            </h2>
            <p className="text-sm text-gray-600 line-clamp-2">
              {profile?.bio || 'プロフィールはまだ書かれていません。'}
            </p>

            {/* SNSリンク */}
            {profile?.sns_links && (
              <div className="flex items-center gap-2 pt-1">
                {profile.sns_links.homepage && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Website
                  </span>
                )}
                {profile.sns_links.twitter && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    X
                  </span>
                )}
                {profile.sns_links.instagram && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Instagram
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 作品グリッド */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              作品 ({filteredEntries.length}件)
            </h3>
            <span className="text-xs text-gray-500">
              {worksFilter === 'displaying' && '展示中のみ'}
              {worksFilter === 'for_sale' && '販売中のみ'}
              {worksFilter === 'all' && 'すべて'}
              {' / '}
              {sortKey === 'new' ? '新着順' : 'いいね順'}
            </span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl">
              表示する作品がありません
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredEntries.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                >
                  <Image
                    src={entry.image_url || '/placeholder.png'}
                    alt={entry.title || 'Artwork'}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs truncate">{entry.title}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredEntries.length > 6 && (
            <p className="text-center text-xs text-gray-500 mt-2">
              他 {filteredEntries.length - 6} 件の作品
            </p>
          )}
        </div>

        {/* 公開ページリンク */}
        <div className="px-4 pb-4">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={!isPublic ? 'pointer-events-none' : ''}
          >
            <Button
              variant="outline"
              className="w-full rounded-xl"
              disabled={!isPublic}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              公開ページを開く
            </Button>
          </a>
          {!isPublic && (
            <p className="text-xs text-amber-600 text-center mt-2">
              公開設定をONにすると閲覧できます
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
