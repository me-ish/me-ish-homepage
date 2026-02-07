// src/app/mypage/MyPageClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import ProfileEditModal from '@/components/ProfileEditModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LikedWorksTab } from './_components/LikedWorksTab';
import { MyWorksTab } from './_components/MyWorksTab';
import {
  Edit3,
  Eye,
  Heart,
  ShoppingCart,
  Coins,
  BadgeCheck,
  ImageIcon,
  Wallet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  UserX,
  Settings,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/* ===================== Types ===================== */
type SNSLinks = { homepage?: string; twitter?: string; instagram?: string };

type ProfileSavePayload = {
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  banner_focus_x?: number | null;
  banner_focus_y?: number | null;
  banner_zoom?: number | null;
  sns_links: SNSLinks;
};

type Profile = {
  id?: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  banner_focus_x?: number | null;
  banner_focus_y?: number | null;
  banner_zoom?: number | null;
  bio?: string | null;
  sns_links?: SNSLinks | null;
};

type Entry = {
  id: number;
  confirmed: boolean;
  display_ready?: boolean | null;
  display_start_at?: string | null;
  display_end_at?: string | null;
  guarantee_total?: number | null;
  guarantee_remaining?: number | null;
  guarantee_period_end?: string | null;
  likes?: number;
  edition_total?: number | null;
  edition_sold?: number | null;
  artist_reward_yen?: number | null;
};

// v_my_sales_summary ビューから取得するデータ型
type SalesSummary = {
  gross_sales_yen: number;
  pending_payout_yen: number;
  paid_out_yen: number;
};

// 閲覧数統計（アーティスト向け）
type ViewStats = {
  totalViews: number;
  uniqueViews: number;
};

// 閲覧者統計（自分が見た作品数）
type MyViewerStats = {
  totalViews: number;
  uniqueWorksViewed: number;
};

/* ===================== Utils ===================== */
const BRAND = '#00a1e9';
const formatYen = (n?: number | null) =>
  typeof n === 'number' ? `¥${n.toLocaleString()}` : '—';
const isUnlimited = (e: Entry) => e.edition_total == null;

/* ===================== Component ===================== */
export default function MyPageClient() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isExhibitor, setIsExhibitor] = useState(false);

  // Phase2: 売上サマリー
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  // Phase2: 銀行口座登録チェック
  const [hasBankAccount, setHasBankAccount] = useState<boolean | null>(null);
  // 閲覧数統計（アーティスト向け）
  const [viewStats, setViewStats] = useState<ViewStats | null>(null);
  // 閲覧者統計（自分が見た作品数）
  const [myViewerStats, setMyViewerStats] = useState<MyViewerStats | null>(null);

  // UI state
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('likes');

  // 退会ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // SSRで location を参照しない
  const [siteOrigin, setSiteOrigin] = useState<string>(
    process.env.NEXT_PUBLIC_SITE_URL ?? ''
  );
  useEffect(() => {
    if (!siteOrigin && typeof window !== 'undefined') {
      setSiteOrigin(window.location.origin);
    }
  }, [siteOrigin]);

  const publicUrl = useMemo(() => {
    const slug = profile?.id || 'me';
    return siteOrigin ? `${siteOrigin}/artists/${slug}` : '';
  }, [siteOrigin, profile]);
  const bannerFocusX = profile?.banner_focus_x ?? 0.5;
  const bannerFocusY = profile?.banner_focus_y ?? 0.5;
  const bannerZoom = profile?.banner_zoom ?? 1;

  // 画面幅（モバイル判定）
  useEffect(() => {
    const check = () => {
      if (typeof window !== 'undefined') setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // トースト自動消去
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  /* -------- 認証復元 -------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUid(data.user?.id ?? null);
        setUserEmail(data.user?.email ?? null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUid(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  /* -------- uid 決定後にプロフィール & 作品を取得 -------- */
  useEffect(() => {
    (async () => {
      if (!uid) {
        setProfile(null);
        setEntries([]);
        setIsExhibitor(false);
        setSalesSummary(null);
        setHasBankAccount(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // profiles（自分の行のみ）
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, banner_url, bio, sns_links')
          .eq('id', uid)
          .returns<Profile>()
          .maybeSingle();

        if (profErr) {
          console.error('[profiles] error:', profErr);
          throw profErr;
        }

        if (!prof) {
          // 初回シード（Google メタから）
          const { data: auth } = await supabase.auth.getUser();
          const meta: any = auth.user?.user_metadata ?? {};
          const seed: Profile = {
            id: uid,
            display_name:
              meta.full_name ||
              meta.name ||
              auth.user?.email?.split('@')[0] ||
              'User',
            bio: null,
            avatar_url: meta.avatar_url || meta.picture || null,
            banner_url: null,
            sns_links: {},
          };
          // seed は Profile 型だが、DB の Insert 型と null/undefined の扱いが異なるため型アサーション
          const { error: upErr } = await supabase.from('profiles').upsert(seed as any);
          if (upErr) throw upErr;
          setProfile(seed);
        } else {
          setProfile(prof);
        }

        // 出展者判定のための簡易チェック
        const { count } = await supabase
          .from('entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid);

        const hasEntries = (count ?? 0) > 0;
        setIsExhibitor(hasEntries);

        // 指標用に簡易取得（confirmed作品のみ）
        const { data: es, error: entriesErr } = await supabase
          .from('entries')
          .select(
            'id, confirmed, display_ready, display_start_at, display_end_at, guarantee_total, guarantee_remaining, guarantee_period_end, likes, edition_total, edition_sold'
          )
          .eq('user_id', uid)
          .eq('confirmed', true);

        if (entriesErr) {
          console.error('[entries] error:', entriesErr);
          throw entriesErr;
        }
        setEntries((es as Entry[]) ?? []);

        // Phase2: 売上サマリーを v_my_sales_summary から取得
        if (hasEntries) {
          const { data: summary, error: summaryErr } = await supabase
            .from('v_my_sales_summary')
            .select('gross_sales_yen, pending_payout_yen, paid_out_yen')
            .eq('user_id', uid)
            .maybeSingle();

          if (summaryErr) {
            console.error('[v_my_sales_summary] error:', summaryErr);
            setSalesSummary(null);
          } else if (summary) {
            setSalesSummary({
              gross_sales_yen: summary.gross_sales_yen ?? 0,
              pending_payout_yen: summary.pending_payout_yen ?? 0,
              paid_out_yen: summary.paid_out_yen ?? 0,
            });
          } else {
            setSalesSummary({
              gross_sales_yen: 0,
              pending_payout_yen: 0,
              paid_out_yen: 0,
            });
          }

          // 閲覧数統計を v_artist_view_stats ビューから取得
          const { data: viewData, error: viewErr } = await supabase
            .from('v_artist_view_stats')
            .select('total_views, unique_views')
            .eq('user_id', uid)
            .maybeSingle();

          if (viewErr) {
            console.error('[v_artist_view_stats] error:', viewErr);
            setViewStats(null);
          } else if (viewData) {
            setViewStats({
              totalViews: viewData.total_views ?? 0,
              uniqueViews: viewData.unique_views ?? 0,
            });
          } else {
            setViewStats({ totalViews: 0, uniqueViews: 0 });
          }
        }

        // 閲覧者統計（自分が見た作品数）を取得
        const { data: myViewData, error: myViewErr } = await supabase
          .from('entry_view_events')
          .select('id, entry_id')
          .eq('viewer_user_id', uid);

        if (myViewErr) {
          console.error('[entry_view_events] error:', myViewErr);
          setMyViewerStats(null);
        } else if (myViewData && myViewData.length > 0) {
          const uniqueEntryIds = new Set(myViewData.map(v => v.entry_id));
          setMyViewerStats({
            totalViews: myViewData.length,
            uniqueWorksViewed: uniqueEntryIds.size,
          });
        } else {
          setMyViewerStats({ totalViews: 0, uniqueWorksViewed: 0 });
        }
      } catch (e: any) {
        console.error('[mypage load] fatal:', e?.message || e);
        setToast(e?.message || '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
    }, [uid, userEmail]);

  // 指標
  const metrics = useMemo(() => {
    const now = Date.now();

    const isInDisplayWindow = (e: Entry) => {
      if (!e.display_ready) return false;

      const startOk = e.display_start_at
        ? new Date(e.display_start_at).getTime() <= now
        : true;

      const endOk = e.display_end_at
        ? now < new Date(e.display_end_at).getTime()
        : true;

      return startOk && endOk;
    };

    const displayingNow = entries.filter(isInDisplayWindow).length;
    const totalLikes = entries.reduce((s, e) => s + (e.likes ?? 0), 0);

    const soldCount = entries.reduce((s, e) => {
      if (isUnlimited(e)) return s + (e.edition_sold ?? 0);
      const soldOut =
        (e.edition_total ?? 0) > 0 &&
        (e.edition_sold ?? 0) >= (e.edition_total ?? 0);
      return s + (soldOut ? (e.edition_total ?? 0) : (e.edition_sold ?? 0));
    }, 0);

    return { displayingNow, totalLikes, soldCount };
  }, [entries]);

  // 保存（upsert）
  async function handleProfileSave(payload: ProfileSavePayload) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const id = profile?.id || auth.user?.id;
      if (!id) throw new Error('ユーザーIDが取得できませんでした。');

      const normalized: Profile = {
        id,
        display_name: payload.display_name.trim(),
        bio: (payload.bio ?? '').trim() || null,
        avatar_url: payload.avatar_url || null,
        banner_url: payload.banner_url || null,
        banner_focus_x: payload.banner_focus_x ?? 0.5,
        banner_focus_y: payload.banner_focus_y ?? 0.5,
        banner_zoom: payload.banner_zoom ?? 1,
        sns_links: payload.sns_links || {},
      };

      const { error } = await supabase.from('profiles').upsert(normalized as any);
      if (error) throw error;

      setProfile(normalized);
      setToast('プロフィールを保存しました');
      setEditOpen(false);
    } catch (e: any) {
      console.error(e);
      setToast(e?.message || '保存に失敗しました');
    }
  }

  // 退会処理
  async function handleAccountDelete() {
    if (deleteConfirmText !== '退会する') return;

    try {
      setDeleteLoading(true);
      const res = await fetch('/api/account/delete', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '退会処理に失敗しました');
      }

      // ログアウト & トップにリダイレクト
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e: any) {
      console.error('[handleAccountDelete]', e);
      setToast(e?.message || '退会処理に失敗しました');
      setDeleteLoading(false);
    }
  }

  return (
    <main className="font-zen min-h-screen bg-gray-50/50 pt-14 md:pt-16">
      {/* ===== Hero / Cover ===== */}
      <section className="relative bg-white">
        {/* Banner */}
        <div className="px-4 md:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="relative w-full aspect-[16/5] overflow-hidden rounded-2xl">
              {profile?.banner_url ? (
                <Image
                  src={profile.banner_url}
                  alt="banner"
                  fill
                  className="object-cover"
                  style={{
                    objectPosition: `${bannerFocusX * 100}% ${bannerFocusY * 100}%`,
                    transform: `scale(${bannerZoom})`,
                    transformOrigin: `${bannerFocusX * 100}% ${bannerFocusY * 100}%`,
                  }}
                  priority
                  unoptimized
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
              )}

              {/* 右上：編集（バナー上に固定） */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-2 text-sm shadow hover:shadow-md border"
                  aria-label="プロフィール編集"
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="hidden sm:inline">プロフィールを編集</span>
                </button>
              </div>
            </div>

            {/* Profile row（通常フロー。見た目だけ被せる） */}
            <div className="relative -mt-8 md:-mt-10 flex items-end gap-4 pb-4">
              <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100 shadow-sm">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name ?? 'avatar'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-gray-400">
                    <BadgeCheck />
                  </div>
                )}
              </div>

              <div className="pb-2 min-w-0">
                <h1 className="font-lilita text-2xl md:text-3xl tracking-wide truncate">
                  {profile?.display_name ?? 'My Portfolio'}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== loading ===== */}
      {loading && (
        <section className="px-4 md:px-6 mt-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex items-center justify-center py-14 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="ml-2">読み込み中...</span>
            </div>
          </div>
        </section>
      )}

      {!loading && (
        <>
          {/* ===== Phase2: 銀行口座未登録の警告 ===== */}
          {isExhibitor && hasBankAccount === false && (
            <section className="px-4 md:px-6 mt-6">
              <div className="mx-auto w-full max-w-6xl">
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      振込先口座が未登録です
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      作品が売れた際の報酬を受け取るには、銀行口座の登録が必要です。
                    </p>
                    <Link
                      href="/settings/bank"
                      className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900 mt-2 underline underline-offset-2"
                    >
                      <Wallet className="w-4 h-4" />
                      口座を登録する
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ===== Metrics (出展者のみ) ===== */}
          {isExhibitor && (
            <section className="px-4 md:px-6 mt-6">
              <div className="mx-auto w-full max-w-6xl">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <MetricCard
                    icon={<BadgeCheck className="w-5 h-5 text-emerald-500" />}
                    label="展示中"
                    value={metrics.displayingNow}
                    highlight={metrics.displayingNow > 0}
                  />
                  <MetricCard
                    icon={<Eye className="w-5 h-5 text-purple-500" />}
                    label="閲覧数"
                    value={viewStats?.totalViews ?? 0}
                    subLabel={`ユニーク ${viewStats?.uniqueViews ?? 0}`}
                  />
                  <MetricCard
                    icon={<Heart className="w-5 h-5 text-pink-500" />}
                    label="いいね"
                    value={metrics.totalLikes}
                  />
                  <MetricCard
                    icon={<ShoppingCart className="w-5 h-5 text-blue-500" />}
                    label="販売数"
                    value={metrics.soldCount}
                  />
                  <MetricCard
                    icon={<Coins className="w-5 h-5 text-yellow-500" />}
                    label="売上"
                    value={formatYen(salesSummary?.gross_sales_yen ?? 0)}
                    subLabel="購入確定"
                  />
                  <MetricCard
                    icon={<Clock className="w-5 h-5 text-orange-500" />}
                    label="入金予定"
                    value={formatYen(salesSummary?.pending_payout_yen ?? 0)}
                    subLabel="振込待ち"
                  />
                  <MetricCard
                    icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                    label="入金済み"
                    value={formatYen(salesSummary?.paid_out_yen ?? 0)}
                    subLabel="振込完了"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ===== 閲覧統計（全ユーザー向け） ===== */}
          {myViewerStats && myViewerStats.uniqueWorksViewed > 0 && (
            <section className="px-4 md:px-6 mt-6">
              <div className="mx-auto w-full max-w-6xl">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                  <Eye className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-gray-700">
                    これまでに <span className="font-semibold text-purple-600">{myViewerStats.uniqueWorksViewed}</span> 作品を閲覧しました
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* ===== Tabs ===== */}
          <section className="px-4 md:px-6 mt-6">
            <div className="mx-auto w-full max-w-6xl">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
                  <TabsTrigger value="likes" className="gap-2">
                    <Heart className="w-4 h-4" />
                    いいねした作品
                  </TabsTrigger>
                  <TabsTrigger value="works" className="gap-2">
                    <ImageIcon className="w-4 h-4" />
                    出展作品
                  </TabsTrigger>
                </TabsList>

                <div className="rounded-2xl border bg-white p-4 md:p-6">
                  <TabsContent value="likes" className="mt-0">
                    {uid ? (
                      <LikedWorksTab userId={uid} />
                    ) : (
                      <div className="py-10 text-center text-gray-500">
                        読み込み中...
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="works" className="mt-0">
                    {uid ? (
                      <MyWorksTab userId={uid} userEmail={userEmail} />
                    ) : (
                      <div className="py-10 text-center text-gray-500">
                        読み込み中...
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </section>

          {/* ===== ギャラリーを見る ===== */}
          <section className="px-4 md:px-6 mt-10">
            <div className="mx-auto w-full max-w-6xl">
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sky-500" />
                  ギャラリーを見る
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href="/float"
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-sky-700">Float Gallery</p>
                      <p className="text-sm text-gray-500">雲の上の美術館</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-sky-500" />
                  </Link>
                  <Link
                    href="/white"
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50/50 transition group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center border">
                      <Layers className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-sky-700">White Gallery</p>
                      <p className="text-sm text-gray-500">白い空間の美術館</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-sky-500" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ===== 設定 ===== */}
          <section className="px-4 md:px-6 mt-6">
            <div className="mx-auto w-full max-w-6xl">
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-500" />
                  設定
                </h2>
                <div className="space-y-2">
                  {/* 振込先口座 */}
                  <Link
                    href="/settings/bank"
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">振込先口座</p>
                        <p className="text-xs text-gray-500">売上の振込に使用する口座</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Link>

                  {/* 区切り線 */}
                  <div className="border-t border-gray-100 my-2" />

                  {/* 退会 */}
                  <button
                    onClick={() => setDeleteDialogOpen(true)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-red-50 transition w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <UserX className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-sm font-medium text-red-600">退会する</p>
                        <p className="text-xs text-gray-500">アカウントを削除します</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 下部余白 */}
          <div className="mb-20" />
        </>
      )}

      {/* 退会確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <UserX className="w-5 h-5" />
              本当に退会しますか？
            </DialogTitle>
            <DialogDescription className="text-left pt-2 space-y-2">
              <p>退会すると以下のデータが削除されます：</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>プロフィール情報</li>
                <li>いいねした作品の履歴</li>
                <li>ログイン情報</li>
              </ul>
              <p className="text-sm text-gray-500 mt-3">
                ※ 出展作品・取引履歴は法令に基づき保持されます。
              </p>
              <p className="font-medium mt-4">
                退会を確定するには「退会する」と入力してください。
              </p>
            </DialogDescription>
          </DialogHeader>

          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="退会する"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={deleteLoading}
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={deleteLoading}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleAccountDelete}
              disabled={deleteConfirmText !== '退会する' || deleteLoading}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  処理中...
                </>
              ) : (
                '退会を確定'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            {/* プロフィール編集モーダル */}
      {editOpen && profile && (
        <ProfileEditModal
          initialProfile={{
            display_name: profile.display_name ?? '',
            bio: profile.bio ?? null,
            avatar_url: profile.avatar_url ?? null,
            banner_url: profile.banner_url ?? null,
            banner_focus_x: profile.banner_focus_x ?? 0.5,
            banner_focus_y: profile.banner_focus_y ?? 0.5,
            banner_zoom: profile.banner_zoom ?? 1,
            sns_links: profile.sns_links ?? {},
          }}
          onSave={handleProfileSave}
          onCancel={() => setEditOpen(false)}
        />
      )}
      {/* トースト */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 text-white text-sm px-4 py-2 shadow z-50">
          {toast}
        </div>
      )}
    </main>
  );
}

/* ===================== Sub Components ===================== */
function MetricCard({
  icon,
  label,
  value,
  subLabel,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subLabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm hover:shadow transition ${
        highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white'
      }`}
    >
      <div className="flex items-center gap-2 text-gray-700">
        {icon}
        <span className="text-xl font-bold">{value}</span>
      </div>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {subLabel && <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>}
    </div>
  );
}
