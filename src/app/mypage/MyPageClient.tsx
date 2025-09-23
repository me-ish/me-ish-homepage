// src/app/mypage/MyPageClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import ProfileEditModal from '@/components/ProfileEditModal';
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
  Infinity as InfinityIcon,
  BadgeCheck,
  Filter,
  ChevronDown,
  Download,
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
  user_id?: string | null;
  title: string;
  image_url: string;
  confirmed: boolean;
  created_at: string;
  likes?: number;
  gallery_type?: 'white' | 'float' | string;
  edition_total?: number | null;
  edition_sold?: number | null;
  price?: number | null;
  meish_fee_yen?: number | null;
  artist_reward_yen?: number | null;
  confirmed_at?: string | null;
  display_start_at?: string | null;
  display_end_at?: string | null;
  sale_type?: 'normal' | 'nft' | null;
  is_sold?: boolean | null; // ← DBに合わせる
};

/* ===================== Utils ===================== */
const BRAND = '#00a1e9';

const SORTS = [
  { key: 'new', label: '新着順' },
  { key: 'likes', label: '人気順（いいね）' },
  { key: 'priceHigh', label: '価格が高い順' },
  { key: 'priceLow', label: '価格が安い順' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

const formatYen = (n?: number | null) => (typeof n === 'number' ? `¥${n.toLocaleString()}` : '—');
const isUnlimited = (e: Entry) => e.edition_total == null;
const editionSummary = (e: Entry) => (isUnlimited(e) ? '∞' : `${e.edition_sold ?? 0}/${e.edition_total ?? 0}`);
const galleryBadgeText = (g?: string) => (g === 'float' ? 'Float' : 'White');
// NFT判定は sale_type のみ
const saleBadgeText = (e: Entry) => (e.sale_type === 'nft' ? 'NFT' : '通常');

/* ===================== Component ===================== */
export default function MyPageClient() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  // UI state
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('new');
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // SSRで location を参照しない
  const [siteOrigin, setSiteOrigin] = useState<string>(process.env.NEXT_PUBLIC_SITE_URL ?? '');
  useEffect(() => {
    if (!siteOrigin && typeof window !== 'undefined') setSiteOrigin(window.location.origin);
  }, [siteOrigin]);

  const publicUrl = useMemo(() => {
    const slug = profile?.id || 'me';
    return siteOrigin ? `${siteOrigin}/artists/${slug}` : '';
  }, [siteOrigin, profile]);

  // 画面幅（モバイル判定）
  useEffect(() => {
    const check = () => typeof window !== 'undefined' && setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
            display_name: meta.full_name || meta.name || auth.user?.email?.split('@')[0] || 'User',
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

        // entries（自分のみ）— 列名をDBに合わせる
        const { data: es, error: esErr } = await supabase
          .from('entries')
          .select(
            [
              'id',
              'user_id',
              'title',
              'image_url',
              'confirmed',
              'created_at',
              'likes',
              'gallery_type',
              'edition_total',
              'edition_sold',
              'price',
              'sale_type',
              'is_sold', // ← ここだけでOK
            ].join(',')
          )
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .returns<Entry[]>();

        if (esErr) {
          console.error('[entries] error:', esErr);
          setEntries([]);
        } else {
          setEntries(es ?? []);
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
    const published = entries.filter((e) => e.confirmed).length;
    const totalLikes = entries.reduce((s, e) => s + (e.likes ?? 0), 0);
    const soldCount = entries.reduce((s, e) => {
      if (isUnlimited(e)) return s + (e.edition_sold ?? 0);
      const soldOut = (e.edition_total ?? 0) > 0 && (e.edition_sold ?? 0) >= (e.edition_total ?? 0);
      return s + (soldOut ? (e.edition_total ?? 0) : (e.edition_sold ?? 0));
    }, 0);
    const rewardYen = entries.reduce((s, e) => s + (e.artist_reward_yen ?? 0), 0);
    return { publishedCount: published, totalLikes, soldCount, rewardYen };
  }, [entries]);

  // 検索・並び替え
  const filtered = useMemo(() => {
    const base = entries.filter((e) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        e.title?.toLowerCase().includes(q) ||
        galleryBadgeText(e.gallery_type)?.toLowerCase().includes(q) ||
        saleBadgeText(e)?.toLowerCase().includes(q)
      );
    });

    const sorted = [...base].sort((a, b) => {
      if (sortKey === 'new') return +new Date(b.created_at) - +new Date(a.created_at);
      if (sortKey === 'likes') return (b.likes ?? 0) - (a.likes ?? 0);
      if (sortKey === 'priceHigh') return (b.price ?? -1) - (a.price ?? -1);
      if (sortKey === 'priceLow')
        return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
      return 0;
    });

    return sorted;
  }, [entries, query, sortKey]);

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
    <main className="font-zen">
      {/* ===== Hero / Cover ===== */}
      <section className="relative">
        <div className="relative h-48 md:h-56 w-full overflow-hidden">
          {profile?.banner_url ? (
            <Image src={profile.banner_url} alt="banner" fill className="object-cover" priority unoptimized />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
          )}
        </div>

        <div className="absolute -bottom-10 left-5 md:left-10 flex items-end gap-4">
          <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.display_name ?? 'avatar'} fill className="object-cover" unoptimized />
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
            <span>プロフィールを編集</span>
          </button>
        </div>
      </section>

      {/* ===== Bio / Links / Share ===== */}
      <section className="mt-16 px-4 md:px-6">
        <div className="rounded-2xl border bg-white p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-gray-700 leading-relaxed md:max-w-3xl">
              {profile?.bio ?? '自己紹介文を追加すると、あなたの世界観が伝わりやすくなります。'}
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
              <button onClick={handleCopy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                <LinkIcon className="w-4 h-4" />
                <span>{copied ? 'コピーしました' : 'URLコピー'}</span>
              </button>
              {publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                  <ExternalLink className="w-4 h-4" />
                  <span>公開ページ</span>
                </a>
              )}
              <button
                onClick={() => {
                  const text = `${profile?.display_name ?? 'Artist'} | me-ish ポートフォリオ\n${publicUrl || ''}`;
                  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=me_ish`;
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

      {/* ===== Metrics ===== */}
      <section className="px-4 md:px-6 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={<BadgeCheck className="w-5 h-5" />} label="公開作品" value={metrics.publishedCount} />
          <MetricCard icon={<Heart className="w-5 h-5 text-pink-500" />} label="いいね" value={metrics.totalLikes} />
          <MetricCard icon={<ShoppingCart className="w-5 h-5" />} label="販売数" value={metrics.soldCount} />
          <MetricCard icon={<Coins className="w-5 h-5" />} label="報酬額" value={formatYen(metrics.rewardYen)} />
        </div>
      </section>

      {/* ===== Controls ===== */}
      <section className="px-4 md:px-6 mt-6">
        <div className="rounded-2xl border bg-white p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex-1">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="作品検索（タイトル / White / Float / 通常 / NFT）"
                className="w-full rounded-xl border px-3 py-2 pr-9 outline-none focus:ring-2 focus:ring-[#00a1e9]/30"
              />
              <Filter className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">並び替え</label>
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none rounded-xl border px-3 py-2 pr-8 text-sm outline-none hover:bg-gray-50"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <Link href="/entry" className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-4 py-2 text-white text-sm font-semibold hover:brightness-[1.05]">
            作品を応募
          </Link>
        </div>
      </section>

      {/* ===== Entries Grid ===== */}
      <section className="px-4 md:px-6 mt-6 mb-20">
        {loading ? (
          <div className="grid place-items-center py-16 text-gray-500">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center py-16 text-gray-500">該当作品がありません。</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        )}
      </section>

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
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 text-white text-sm px-3 py-2 shadow">
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
    <div className="rounded-2xl bg-white p-4 shadow-sm hover:shadow transition">
      <div className="flex items-center gap-2 text-gray-700">
        {icon}
        <span className="text-xl font-bold">{value}</span>
      </div>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  // 完売は is_sold を優先、未設定ならエディションで推定
  const sold = useMemo(() => {
    if (typeof entry.is_sold === 'boolean') return entry.is_sold;
    if (isUnlimited(entry)) return false;
    const total = entry.edition_total ?? 0;
    const soldCount = entry.edition_sold ?? 0;
    return total > 0 && soldCount >= total;
  }, [entry]);

  // NFT判定は sale_type のみ
  const nft = entry.sale_type === 'nft';
  const thumb = entry.image_url || '/placeholder.png';

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition">
      {/* Thumbnail */}
      <div className="relative w-full h-52 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt={entry.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
        {sold && (
          <div className="absolute top-2 left-2 rounded-full bg-black/70 text-white text-xs px-2 py-1">SOLD</div>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <span className="rounded-full bg-white/90 backdrop-blur text-xs px-2 py-1 border">
            {galleryBadgeText(entry.gallery_type)}
          </span>
          <span
            className={`rounded-full backdrop-blur text-xs px-2 py-1 border ${
              nft ? 'bg-[#00a1e9]/10 text-[#006a9c] border-[#00a1e9]/30' : 'bg-gray-50'
            }`}
          >
            {saleBadgeText(entry)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-800 truncate">{entry.title}</h3>
        <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Heart className="w-4 h-4 text-pink-500" />
              <span>{entry.likes ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              {isUnlimited(entry) ? (
                <>
                  <InfinityIcon className="w-4 h-4" />
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  <span>{editionSummary(entry)}</span>
                </>
              )}
            </span>
          </div>
          <div className="font-medium text-gray-700">{formatYen(entry.price)}</div>
        </div>
      </div>

      {/* Hover Actions */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition grid place-items-center">
        <div className="flex items-center gap-3">
          <a href={`/artworks/${entry.id}`} className="p-2 rounded-full bg-white hover:bg-gray-100 shadow" aria-label="詳細を見る">
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            className="p-2 rounded-full bg-white hover:bg-gray-100 shadow"
            aria-label="シェア"
            onClick={() => {
              const base = typeof window !== 'undefined' ? window.location.origin : '';
              const url = base ? `${base}/artworks/${entry.id}` : `/artworks/${entry.id}`;
              const text = `${entry.title} | me-ish`;
              const share = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                text
              )}&url=${encodeURIComponent(url)}&hashtags=me_ish`;
              window.open(share, '_blank', 'noopener,noreferrer');
            }}
          >
            <Share2 className="w-5 h-5" />
          </button>
          {entry.sale_type !== 'nft' && (
            <a href={`/downloads/${entry.id}`} className="p-2 rounded-full bg-white hover:bg-gray-100 shadow" aria-label="ダウンロード（購入者）">
              <Download className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

