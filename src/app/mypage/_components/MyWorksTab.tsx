// src/app/mypage/_components/MyWorksTab.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { getEntriesWithStatus } from '@/lib/portfolio/queries';
import {
  EntryStatusBadge,
  getEntryStatus,
  getStatusDescription,
} from './EntryStatusBadge';
import { PortfolioPromotionCard } from './PortfolioPromotionCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Heart,
  Eye,
  Calendar,
  Loader2,
  Plus,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Package,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type { EntryWithStatus } from '@/lib/portfolio/types';

const SORT_OPTIONS = [
  { key: 'new', label: '新着順' },
  { key: 'likes', label: 'いいね順' },
  { key: 'views', label: '閲覧数順' },
  { key: 'status', label: 'ステータス順' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['key'];

// ステータスのソート順（数値が小さいほど上位）
const STATUS_PRIORITY: Record<string, number> = {
  failed: 1,
  running: 2,
  queued: 3,
  displaying: 4,
  ready: 5,
  approved: 6,
  reviewing: 7,
};

export function MyWorksTab({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<EntryWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('new');
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
      if (sortKey === 'views') {
        return (b.view_count ?? 0) - (a.view_count ?? 0);
      }
      // status
      const aStatus = getEntryStatus(a).status;
      const bStatus = getEntryStatus(b).status;
      return (
        (STATUS_PRIORITY[aStatus] ?? 99) - (STATUS_PRIORITY[bStatus] ?? 99)
      );
    });
  }, [entries, sortKey]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Phase2: ステータス別の件数を集計
  const statusCounts = useMemo(() => {
    const counts = {
      displaying: 0,
      ready: 0,
      processing: 0, // running + queued
      reviewing: 0, // reviewing + approved
      failed: 0,
    };
    entries.forEach((e) => {
      const status = getEntryStatus(e).status;
      if (status === 'displaying') counts.displaying++;
      else if (status === 'ready') counts.ready++;
      else if (status === 'running' || status === 'queued') counts.processing++;
      else if (status === 'reviewing' || status === 'approved') counts.reviewing++;
      else if (status === 'failed') counts.failed++;
    });
    return counts;
  }, [entries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  // 出展作品がない場合
  if (sortedEntries.length === 0) {
    return (
      <div className="space-y-8">
        <div className="py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            出展作品がありません
          </h3>
          <p className="text-gray-500 mb-6">
            作品を応募してギャラリーに展示しましょう
            <br />
            展示された作品をまとめてポートフォリオを公開できます
          </p>
          <Link
            href="/entry"
            className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-5 py-2.5 text-white font-medium hover:brightness-105 transition"
          >
            <Plus className="h-4 w-4" />
            作品を応募する
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* コントロール */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{sortedEntries.length}件の作品</p>
        <div className="flex items-center gap-3">
          <Select
            value={sortKey}
            onValueChange={(v: string) => setSortKey(v as SortKey)}
          >
            <SelectTrigger className="w-[150px]">
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
          <Link
            href="/entry"
            className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-4 py-2 text-white text-sm font-medium hover:brightness-105 transition"
          >
            <Plus className="h-4 w-4" />
            応募
          </Link>
        </div>
      </div>

      {/* Phase2: ステータスサマリー（作品がある場合のみ） */}
      {sortedEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {statusCounts.displaying > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm">
              <Eye className="h-3.5 w-3.5" />
              <span>公開中 {statusCounts.displaying}</span>
            </div>
          )}
          {statusCounts.ready > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm">
              <span>準備完了 {statusCounts.ready}</span>
            </div>
          )}
          {statusCounts.processing > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>処理中 {statusCounts.processing}</span>
            </div>
          )}
          {statusCounts.reviewing > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm">
              <span>審査中 {statusCounts.reviewing}</span>
            </div>
          )}
          {statusCounts.failed > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>エラー {statusCounts.failed}</span>
            </div>
          )}
        </div>
      )}

      {/* カード形式の作品一覧 */}
      <div className="space-y-3">
        {sortedEntries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            isExpanded={expandedId === entry.id}
            onToggle={() => toggleExpand(entry.id)}
          />
        ))}
      </div>

      {/* ポートフォリオ誘導カード */}
      <PortfolioPromotionCard />
    </div>
  );
}

interface EntryCardProps {
  entry: EntryWithStatus;
  isExpanded: boolean;
  onToggle: () => void;
}

function EntryCard({ entry, isExpanded, onToggle }: EntryCardProps) {
  const imageUrl = entry.image_url || '/placeholder.png';
  const statusInfo = getEntryStatus(entry);
  const statusDescription = getStatusDescription(entry);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
    });
  };

  // 販売情報
  const isSelling = entry.is_for_sale && entry.price;
  const editionTotal = entry.edition_total;
  const editionSold = entry.edition_sold ?? 0;
  const editionRemaining =
    editionTotal != null ? Math.max(0, editionTotal - editionSold) : null;
  const isUnlimited = entry.edition_total == null && entry.is_for_sale;

  // 展示期間
  const displayPeriod = entry.display_start_at
    ? `${formatShortDate(entry.display_start_at)} 〜 ${entry.display_end_at ? formatShortDate(entry.display_end_at) : '無期限'}`
    : '—';

  // ステータス判定
  const hasError = statusInfo.status === 'failed';
  const isProcessing = statusInfo.status === 'running' || statusInfo.status === 'queued';
  const isDisplaying = statusInfo.status === 'displaying';

  // プログレスステップ計算（展示中までの進捗）
  const getProgressStep = () => {
    switch (statusInfo.status) {
      case 'reviewing': return 1;
      case 'approved': return 2;
      case 'queued': return 3;
      case 'running': return 4;
      case 'ready': return 5;
      case 'displaying': return 6;
      case 'failed': return -1;
      default: return 0;
    }
  };
  const progressStep = getProgressStep();

  return (
    <Card
      className={`overflow-hidden transition-all ${
        hasError ? 'border-red-200 bg-red-50/30' :
        isProcessing ? 'border-amber-200 bg-amber-50/30' :
        isDisplaying ? 'border-emerald-200' : ''
      }`}
    >
      <CardContent className="p-0">
        {/* Phase2: ステータスプログレスバー（処理中の作品のみ） */}
        {(isProcessing || statusInfo.status === 'approved' || statusInfo.status === 'reviewing' || statusInfo.status === 'ready') && progressStep > 0 && (
          <div className="px-4 pt-3 pb-0">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    step <= progressStep
                      ? step === progressStep && isProcessing
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-emerald-400'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {statusInfo.status === 'reviewing' && '審査中...'}
              {statusInfo.status === 'approved' && '承認済み - 処理待ち'}
              {statusInfo.status === 'queued' && '待機中 - 順番を待っています'}
              {statusInfo.status === 'running' && '処理中...'}
              {statusInfo.status === 'ready' && '展示準備完了 - まもなく公開'}
            </p>
          </div>
        )}

        {/* エラー時のバナー */}
        {hasError && (
          <div className="px-4 pt-3 pb-0">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">処理エラーが発生しました</span>
            </div>
          </div>
        )}

        {/* メイン行 */}
        <div className="flex items-center gap-4 p-4">
          {/* サムネイル */}
          <Link href={`/works/${entry.id}`} className="flex-shrink-0 relative">
            <div
  className={[
    "relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 ring-1",
    isDisplaying ? "ring-emerald-300" : isProcessing ? "ring-amber-300" : hasError ? "ring-red-300" : "ring-gray-200",
  ].join(" ")}
>
              <Image
                src={imageUrl}
                alt={entry.title || 'Artwork'}
                fill
                className="object-cover"
                sizes="80px"
              />
              </div>
          </Link>

          {/* 作品情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/works/${entry.id}`}
                  className="font-medium text-gray-900 hover:text-[#00a1e9] transition-colors line-clamp-1 block"
                >
                  {entry.title || 'Untitled'}
                </Link>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <EntryStatusBadge entry={entry} />
                  {entry.gallery_type && (
                    <Badge variant="outline" className="text-xs">
                      {entry.gallery_type === 'float' ? 'Float' : 'White'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 統計 */}
              <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-4 w-4 text-pink-500" />
                  {entry.likes}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {entry.view_count ?? 0}
                </span>
              </div>
            </div>

            {/* サブ情報（モバイルで統計表示） */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 sm:hidden">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3 text-pink-500" />
                {entry.likes}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {entry.view_count ?? 0}
              </span>
            </div>
          </div>

          {/* 展開ボタン */}
          <button
            onClick={onToggle}
            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isExpanded ? '詳細を閉じる' : '詳細を開く'}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>

        {/* 展開パネル */}
        {isExpanded && (
          <div className="border-t bg-gray-50/50 p-4 space-y-4">
            {/* ステータス説明 */}
            <div
              className={`p-3 rounded-lg text-sm ${
                hasError
                  ? 'bg-red-100 text-red-800'
                  : 'bg-white border text-gray-700'
              }`}
            >
              <div className="flex items-start gap-2">
                {hasError && <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium">{statusInfo.label}</p>
                  <p className="mt-1 text-gray-600">{statusDescription}</p>
                  {entry.job_attempts != null && entry.job_attempts > 1 && (
                    <p className="mt-1 text-xs text-gray-500">
                      試行回数: {entry.job_attempts}回
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 詳細グリッド */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* 展示期間 */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  展示期間
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {displayPeriod}
                </p>
              </div>

              {/* 応募日 */}
              <div className="space-y-1">
                <p className="text-xs text-gray-500">応募日</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(entry.created_at)}
                </p>
              </div>

              {/* 販売情報 */}
              {isSelling && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">販売価格</p>
                    <p className="text-sm font-medium text-gray-900">
                      ¥{entry.price?.toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      エディション
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {isUnlimited ? (
                        <span>
                          無制限（{editionSold}枚販売済）
                        </span>
                      ) : editionTotal != null ? (
                        <span>
                          {editionSold}/{editionTotal}
                          <span className="text-gray-500 ml-1">
                            （残{editionRemaining}枚）
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* アクション */}
            <div className="flex items-center gap-2 pt-2">
              <Link
                href={`/works/${entry.id}`}
                className="inline-flex items-center gap-1 text-sm text-[#00a1e9] hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                作品ページを見る
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
