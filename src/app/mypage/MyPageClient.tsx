// src/app/mypage/MyPageClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import ProfileEditModal from '@/components/ProfileEditModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LikedWorksTab } from './_components/LikedWorksTab';
import { MyWorksTab } from './_components/MyWorksTab';
import {
  Edit3,
  Globe,
  Instagram,
  Heart,
  ShoppingCart,
  Coins,
  Share2,
  Link as LinkIcon,
  ExternalLink,
  BadgeCheck,
  ImageIcon,
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

/* ===================== Types ===================== */
type SNSLinks = { homepage?: string; twitter?: string; instagram?: string };

type ProfileSavePayload = {
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  sns_links: SNSLinks;
};

type Profile = {
  id?: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  sns_links?: SNSLinks | null;
};

type Entry = {
  id: number;
  confirmed: boolean;
  display_ready?: boolean | null;

  // ✅ 展示中（期間内）判定用
  display_start_at?: string | null;
  display_end_at?: string | null;

  likes?: number;
  edition_total?: number | null;
  edition_sold?: number | null;

  // ※ entries側の artist_reward_yen は「支払予定/済み」と一致しない可能性があるため、
  // MyPageの“金額”カードでは使わない（誤認防止）
  artist_reward_yen?: number | null;
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isExhibitor, setIsExhibitor] = useState(false);

  const [grossSalesYen, setGrossSalesYen] = useState<number>(0); // ✅ 売上（購入確定）

  // UI state
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('likes');

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
      if (mounted) setUid(data.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUid(session?.user?.id ?? null);
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
        setGrossSalesYen(0);
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
          const { error: upErr } = await supabase.from('profiles').upsert(seed);
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

        setIsExhibitor((count ?? 0) > 0);

        // 指標用に簡易取得（confirmed作品のみ）
        const { data: es, error: entriesErr } = await supabase
          .from('entries')
          .select(
            'id, confirmed, display_ready, display_start_at, display_end_at, likes, edition_total, edition_sold'
          )
          .eq('user_id', uid)
          .eq('confirmed', true);

        if (entriesErr) {
          console.error('[entries] error:', entriesErr);
          throw entriesErr;
        }
        setEntries((es as Entry[]) ?? []);

        // ✅ 売上（購入確定）: sales.price の合計（purchased_at が入っているものだけ）
        // sales.entry_id -> entries.id のFKが張られている前提（entries!inner）
        const { data: salesRows, error: salesErr } = await supabase
          .from('sales')
          .select('price, purchased_at, entries!inner(user_id)')
          .eq('entries.user_id', uid)
          .not('purchased_at', 'is', null);

        if (salesErr) {
          console.error('[sales] error:', salesErr);
          setGrossSalesYen(0);
        } else {
          const sum = (salesRows ?? []).reduce((acc: number, r: any) => {
            const v = typeof r.price === 'number' ? r.price : Number(r.price ?? 0);
            return acc + (Number.isFinite(v) ? v : 0);
          }, 0);
          setGrossSalesYen(sum);
        }
      } catch (e: any) {
        console.error('[mypage load] fatal:', e?.message || e);
        setToast(e?.message || '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

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

    const displayingNow = entries.filter(isInDisplayWindow).length; // ✅ 現在展示中（期間内）
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

  // URLコピー
  const handleCopy = async () => {
    try {
      const url = publicUrl || (siteOrigin ? `${siteOrigin}/artists/me` : '');
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setToast('公開URLをコピーしました');
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setToast('コピーに失敗しました');
    }
  };

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
        sns_links: payload.sns_links || {},
      };

      const { error } = await supabase.from('profiles').upsert(normalized);
      if (error) throw error;

      setProfile(normalized);
      setToast('プロフィールを保存しました');
      setEditOpen(false);
    } catch (e: any) {
      console.error(e);
      setToast(e?.message || '保存に失敗しました');
    }
  }

  return (
    <main className="font-zen min-h-screen bg-gray-50/50">
      {/* ===== Hero / Cover ===== */}
      <section className="relative bg-white">
        <div className="relative h-48 md:h-56 w-full overflow-hidden">
          {profile?.banner_url ? (
            <Image
              src={profile.banner_url}
              alt="banner"
              fill
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
          )}
        </div>

        <div className="absolute -bottom-10 left-5 md:left-10 flex items-end gap-4">
          <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100">
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
          <div className="pb-2">
            <h1 className="font-lilita text-2xl md:text-3xl tracking-wide">
              {profile?.display_name ?? 'My Portfolio'}
            </h1>
          </div>
        </div>

        {/* 右上：編集 */}
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
      </section>

      {/* ===== Bio / Links / Share ===== */}
      <section className="mt-16 px-4 md:px-6">
        <div className="rounded-2xl border bg-white p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-gray-700 leading-relaxed md:max-w-3xl">
              {profile?.bio ??
                '自己紹介文を追加すると、あなたの世界観が伝わりやすくなります。'}
            </p>
            <div className="flex items-center gap-2">
              {profile?.sns_links?.homepage && (
                <a
                  href={profile.sns_links.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Globe className="w-4 h-4" />
                  <span>Website</span>
                </a>
              )}
              {profile?.sns_links?.twitter && (
                <a
                  href={profile.sns_links.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <FaXTwitter className="w-4 h-4" />
                  <span>X</span>
                </a>
              )}
              {profile?.sns_links?.instagram && (
                <a
                  href={profile.sns_links.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Instagram className="w-4 h-4" />
                  <span>Instagram</span>
                </a>
              )}
            </div>
          </div>

          {/* Share Public URL */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 overflow-hidden rounded-xl border bg-gray-50 px-3 py-2 text-sm text-gray-600">
              <span className="truncate">{publicUrl || '/artists/...'} </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              >
                <LinkIcon className="w-4 h-4" />
                <span>{copied ? 'コピーしました' : 'URLコピー'}</span>
              </button>
              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>公開ページ</span>
                </a>
              )}
              <button
                onClick={() => {
                  const text = `${
                    profile?.display_name ?? 'Artist'
                  } | me-ish ポートフォリオ\n${publicUrl || ''}`;
                  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    text
                  )}&hashtags=me_ish`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              >
                <Share2 className="w-4 h-4" />
                <span>シェア</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Metrics (出展者のみ) ===== */}
      {isExhibitor && (
        <section className="px-4 md:px-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<BadgeCheck className="w-5 h-5" />}
              label="展示中"
              value={metrics.displayingNow}
            />
            <MetricCard
              icon={<Heart className="w-5 h-5 text-pink-500" />}
              label="いいね"
              value={metrics.totalLikes}
            />
            <MetricCard
              icon={<ShoppingCart className="w-5 h-5" />}
              label="販売数"
              value={metrics.soldCount}
            />
            <MetricCard
              icon={<Coins className="w-5 h-5" />}
              label="売上（購入確定）"
              value={formatYen(grossSalesYen)}
            />
          </div>
        </section>
      )}

      {/* ===== Tabs ===== */}
      <section className="px-4 md:px-6 mt-6">
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
                <div className="py-10 text-center text-gray-500">読み込み中...</div>
              )}
            </TabsContent>

            <TabsContent value="works" className="mt-0">
              {uid ? (
                <MyWorksTab userId={uid} />
              ) : (
                <div className="py-10 text-center text-gray-500">読み込み中...</div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </section>

      {/* 下部余白 */}
      <div className="mb-20" />

      {/* モバイルFAB */}
      {isMobile && (
        <button
          onClick={() => setEditOpen(true)}
          className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full text-white px-4 py-3 shadow-lg"
          style={{ backgroundColor: BRAND }}
          aria-label="プロフィール編集"
        >
          <Edit3 className="w-4 h-4" />
          <span>編集</span>
        </button>
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 text-white text-sm px-4 py-2 shadow z-50">
          {toast}
        </div>
      )}

      {/* プロフィール編集モーダル */}
      {editOpen && (
        <ProfileEditModal
          initialProfile={{
            display_name: profile?.display_name ?? '',
            bio: profile?.bio ?? '',
            avatar_url: profile?.avatar_url ?? null,
            banner_url: profile?.banner_url ?? null,
            sns_links: profile?.sns_links ?? {},
          }}
          onSave={handleProfileSave}
          onCancel={() => setEditOpen(false)}
        />
      )}
    </main>
  );
}

/* ===================== Sub Components ===================== */
function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-white border p-4 shadow-sm hover:shadow transition">
      <div className="flex items-center gap-2 text-gray-700">
        {icon}
        <span className="text-xl font-bold">{value}</span>
      </div>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
