// src/app/mypage/portfolio/PortfolioSettingsClient.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  getPortfolioProfile,
  getPortfolioEntries,
  upsertPortfolioProfile,
  updateEntryPortfolioHidden,
  getUserProfile,
  type UserProfile,
} from '@/lib/portfolio/queries';
import type {
  PortfolioProfile,
  EntryWithStatus,
  WorksFilter,
  SortKey,
} from '@/lib/portfolio/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Link as LinkIcon,
  ExternalLink,
  Eye,
  EyeOff,
  ArrowLeft,
  Check,
  Filter,
  ArrowUpDown,
  ImageIcon,
  Search,
  Pencil,
} from 'lucide-react';
import { WorkVisibilityCard } from './_components/WorkVisibilityCard';
import { PortfolioPreview } from './_components/PortfolioPreview';

type VisibilityFilter = 'all' | 'visible' | 'hidden';

export default function PortfolioSettingsClient() {
  // ユーザー情報
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ポートフォリオ設定
  const [portfolioProfile, setPortfolioProfile] = useState<PortfolioProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<EntryWithStatus[]>([]);

  // 作品フィルタ・検索（設定パネル内のUI用）
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 保存状態
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 公開URL
  const [siteOrigin, setSiteOrigin] = useState<string>(
    process.env.NEXT_PUBLIC_SITE_URL ?? ''
  );
  const [copied, setCopied] = useState(false);

  // トースト自動消去
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // サイトオリジン取得
  useEffect(() => {
    if (!siteOrigin && typeof window !== 'undefined') {
      setSiteOrigin(window.location.origin);
    }
  }, [siteOrigin]);

  // 公開URL
  const publicUrl = useMemo(() => {
    if (!siteOrigin || !userId) return '';
    return `${siteOrigin}/artists/${userId}`;
  }, [siteOrigin, userId]);

  // 初期データ取得
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUserId(null);
          return;
        }
        setUserId(user.id);

        // 並行取得
        const [profileData, entriesData, userProf] = await Promise.all([
          getPortfolioProfile(supabase, user.id),
          getPortfolioEntries(supabase, user.id),
          getUserProfile(supabase, user.id),
        ]);

        setPortfolioProfile(profileData);
        setEntries(entriesData);
        setUserProfile(userProf);
      } catch (err) {
        console.error('[PortfolioSettingsClient] init error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // プロフィール設定更新
  const handleUpdateProfile = useCallback(
    async (updates: Partial<Pick<PortfolioProfile, 'is_public' | 'works_filter' | 'sort_key'>>) => {
      if (!userId) return;
      setSaving(true);
      try {
        const result = await upsertPortfolioProfile(supabase, userId, updates);
        if (result.success) {
          setPortfolioProfile((prev) =>
            prev
              ? { ...prev, ...updates }
              : {
                  id: '',
                  user_id: userId,
                  public_slug: null,
                  is_public: false,
                  mode: 'template',
                  aura_request_id: null,
                  works_filter: 'displaying',
                  sort_key: 'new',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  ...updates,
                }
          );
          setToast('設定を保存しました');
        } else {
          setToast('保存に失敗しました');
        }
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  // 作品の表示/非表示切替
  const handleToggleEntryVisibility = useCallback(
    async (entryId: number, currentHidden: boolean) => {
      const result = await updateEntryPortfolioHidden(supabase, entryId, !currentHidden);
      if (result.success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, portfolio_hidden: !currentHidden } : e
          )
        );
        setToast(!currentHidden ? '非表示にしました' : '表示に戻しました');
      } else {
        setToast('更新に失敗しました');
      }
    },
    []
  );

  // URLコピー
  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setToast('URLをコピーしました');
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setToast('コピーに失敗しました');
    }
  };

  // フィルタ・検索（設定パネル内のUI用）
  const filteredEntries = useMemo(() => {
    let result = entries;

    if (visibilityFilter === 'visible') {
      result = result.filter((e) => !e.portfolio_hidden);
    } else if (visibilityFilter === 'hidden') {
      result = result.filter((e) => e.portfolio_hidden);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.title?.toLowerCase().includes(q));
    }

    return result;
  }, [entries, visibilityFilter, searchQuery]);

  // カウント
  const counts = useMemo(() => {
    return {
      all: entries.length,
      visible: entries.filter((e) => !e.portfolio_hidden).length,
      hidden: entries.filter((e) => e.portfolio_hidden).length,
    };
  }, [entries]);

  // ローディング中
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  // 未ログイン
  if (!userId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 mb-4">
              ポートフォリオ設定を行うにはログインが必要です。
            </p>
            <Link href="/login?redirect=/mypage/portfolio">
              <Button>ログイン</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPublic = portfolioProfile?.is_public ?? false;
  const worksFilter = portfolioProfile?.works_filter ?? 'displaying';
  const sortKey = portfolioProfile?.sort_key ?? 'new';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/mypage"
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          マイページに戻る
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Pencil className="h-6 w-6 text-[#00a1e9]" />
          公開ページを編集
        </h1>
        <p className="text-gray-600 mt-1">
          公開ポートフォリオの表示内容をカスタマイズできます。右側のプレビューで確認しながら設定してください。
        </p>
      </div>

      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左カラム: 設定パネル */}
        <div className="space-y-6">
          {/* セクションA: 公開設定 */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">公開設定</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    ONにするとURLで誰でもアクセスできます
                  </p>
                </div>
                {/* トグルスイッチ */}
                <button
                  type="button"
                  onClick={() => handleUpdateProfile({ is_public: !isPublic })}
                  disabled={saving}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/30 focus:ring-offset-2 ${
                    isPublic ? 'bg-[#00a1e9]' : 'bg-gray-200'
                  } ${saving ? 'opacity-50' : ''}`}
                  role="switch"
                  aria-checked={isPublic}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isPublic ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 公開ステータス */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isPublic
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isPublic ? (
                  <>
                    <Eye className="h-4 w-4" />
                    <span>公開中</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span>非公開</span>
                  </>
                )}
              </div>

              {/* 公開URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">公開URL</label>
                <div className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-xl border bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                    <span className="truncate block">{publicUrl || '/artists/...'}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      disabled={!publicUrl}
                      className="rounded-xl flex-1"
                    >
                      <LinkIcon className="mr-2 h-4 w-4" />
                      {copied ? 'コピー済み' : 'URLコピー'}
                    </Button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex-1 ${!isPublic ? 'pointer-events-none opacity-50' : ''}`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isPublic}
                        className="rounded-xl w-full"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        公開ページ
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* セクションB: 表示ルール */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Filter className="h-5 w-5 text-[#00a1e9]" />
                表示ルール
              </h2>

              {/* 作品の表示設定 */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">
                  表示する作品
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['displaying', 'for_sale', 'all'] as WorksFilter[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleUpdateProfile({ works_filter: value })}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border transition ${
                        worksFilter === value
                          ? 'bg-[#00a1e9]/10 text-[#007bb3] border-[#00a1e9]/30 font-medium'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      } ${saving ? 'opacity-50' : ''}`}
                    >
                      {worksFilter === value && <Check className="h-4 w-4" />}
                      {value === 'displaying' && '展示中のみ'}
                      {value === 'for_sale' && '販売中のみ'}
                      {value === 'all' && 'すべて'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 並び順 */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  並び順
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['new', 'likes'] as SortKey[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleUpdateProfile({ sort_key: value })}
                      disabled={saving}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border transition ${
                        sortKey === value
                          ? 'bg-[#00a1e9]/10 text-[#007bb3] border-[#00a1e9]/30 font-medium'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      } ${saving ? 'opacity-50' : ''}`}
                    >
                      {sortKey === value && <Check className="h-4 w-4" />}
                      {value === 'new' && '新着順'}
                      {value === 'likes' && 'いいね順'}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* セクションC: 表示する作品 */}
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-[#00a1e9]" />
                  作品の表示設定
                </h2>
                <p className="text-sm text-gray-500">
                  {counts.visible}件表示 / {counts.all}件中
                </p>
              </div>

              {/* フィルタ + 検索 */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'visible', 'hidden'] as VisibilityFilter[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setVisibilityFilter(value)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition ${
                        visibilityFilter === value
                          ? 'bg-[#00a1e9]/10 text-[#007bb3] border-[#00a1e9]/25'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span>{value === 'all' ? 'すべて' : value === 'visible' ? '表示中' : '非表示'}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100">
                        {value === 'all' ? counts.all : value === 'visible' ? counts.visible : counts.hidden}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="タイトルで検索..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/30 focus:border-[#00a1e9]/50"
                  />
                </div>
              </div>

              {/* 作品一覧 */}
              {entries.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-600 mb-1">承認済みの作品がありません</p>
                  <p className="text-sm text-gray-500">
                    作品を応募して承認されると表示されます
                  </p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">
                  該当する作品がありません
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {filteredEntries.map((entry) => (
                    <WorkVisibilityCard
                      key={entry.id}
                      entry={entry}
                      onToggle={() =>
                        handleToggleEntryVisibility(entry.id, entry.portfolio_hidden ?? false)
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右カラム: プレビュー */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <PortfolioPreview
            profile={userProfile}
            entries={entries}
            worksFilter={worksFilter}
            sortKey={sortKey}
            isPublic={isPublic}
            publicUrl={publicUrl}
          />
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 text-white text-sm px-4 py-2.5 shadow-lg z-50 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
