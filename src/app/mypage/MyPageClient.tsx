'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
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
  Infinity as InfinityIcon, // import名の衝突を避ける
  BadgeCheck,
  Filter,
  ChevronDown,
  Download,
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

/* ===================== Types ===================== */
type SNSLinks = {
  homepage?: string;
  twitter?: string;
  instagram?: string;
};

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
  tagline?: string | null;
  bio?: string | null;
  sns_links?: SNSLinks | null;
};

type Entry = {
  id: number;
  title: string;
  image_url: string;
  confirmed: boolean;
  created_at: string;
  likes?: number;
  gallery_type?: 'white' | 'float' | string;
  edition_total?: number | null; // null/undefined => 無制限
  edition_sold?: number;
  price?: number | null; // 税込（円）
  meish_fee_yen?: number | null;
  artist_reward_yen?: number | null;
  confirmed_at?: string | null;
  display_start_at?: string | null;
  display_end_at?: string | null;
  sale_type?: 'normal' | 'nft' | null;
  is_nft?: boolean | null;
  sold?: boolean | null;
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

const formatYen = (n?: number | null) =>
  typeof n === 'number' ? `¥${n.toLocaleString()}` : '—';

const isUnlimited = (e: Entry) =>
  e.edition_total === null || e.edition_total === undefined;

const editionSummary = (e: Entry) => {
  if (isUnlimited(e)) return '∞';
  const sold = e.edition_sold ?? 0;
  const total = e.edition_total ?? 0;
  return `${sold}/${total}`;
};

const galleryBadgeText = (g?: string) => (g === 'float' ? 'Float' : 'White');
const saleBadgeText = (e: Entry) => (e.is_nft || e.sale_type === 'nft' ? 'NFT' : '通常');

/* ===================== Component ===================== */
export default function MyPageClient() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  // UI state
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('new');
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 編集モーダル
  const [editOpen, setEditOpen] = useState(false);

  // SSRで location/window を参照しない（ENV優先、無ければクライアントで補完）
  const [siteOrigin, setSiteOrigin] = useState<string>(
    process.env.NEXT_PUBLIC_SITE_URL ?? ''
  );
  useEffect(() => {
    if (!siteOrigin && typeof window !== 'undefined') {
      setSiteOrigin(window.location.origin);
    }
  }, [siteOrigin]);

  // 公開URL（slugは id 優先、無ければ display_name）
  const publicUrl = useMemo(() => {
    const slug = profile?.id || profile?.display_name || 'me';
    return siteOrigin ? `${siteOrigin}/artists/${encodeURIComponent(slug)}` : '';
  }, [siteOrigin, profile]);

  // モバイル判定（クライアントのみ）
  useEffect(() => {
    const check = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 初期ロード（クライアントのみ）
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Profile
        const { data: profData, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, banner_url, tagline, bio, sns_links')
          .returns<Profile>() // 型を確定
          .maybeSingle();     // 0/1行想定

        if (!profErr) {
          setProfile(profData ?? null);
        }

        // Entries
        const { data: entriesData, error: entriesErr } = await supabase
          .from('entries')
          .select(
            [
              'id',
              'title',
              'image_url',
              'confirmed',
              'created_at',
              'likes',
              'gallery_type',
              'edition_total',
              'edition_sold',
              'price',
              'meish_fee_yen',
              'artist_reward_yen',
              'confirmed_at',
              'display_start_at',
              'display_end_at',
              'sale_type',
              'is_nft',
              'sold',
            ].join(',')
          )
          .order('created_at', { ascending: false })
          .returns<Entry[]>(); // GenericStringError対策：結果型を固定

        if (entriesErr) {
          setEntries([]);
        } else {
          setEntries(entriesData ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 指標
  const metrics = useMemo(() => {
    const published = entries.filter((e) => e.confirmed).length;
    const totalLikes = entries.reduce((s, e) => s + (e.likes ?? 0), 0);
    const soldCount = entries.reduce((s, e) => {
      if (isUnlimited(e)) return s + (e.edition_sold ?? 0);
      const soldOut =
        (e.edition_total ?? 0) > 0 && (e.edition_sold ?? 0) >= (e.edition_total ?? 0);
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
      if (sortKey === 'new') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortKey === 'likes') {
        return (b.likes ?? 0) - (a.likes ?? 0);
      }
      if (sortKey === 'priceHigh') {
        return (b.price ?? -1) - (a.price ?? -1);
      }
      if (sortKey === 'priceLow') {
        return (
          (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER)
        );
      }
      return 0;
    });

    return sorted;
  }, [entries, query, sortKey]);

  // クリップボード
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

async function handleProfileSave(payload: ProfileSavePayload) {
  try {
    let targetId = profile?.id;
    if (!targetId) {
      const { data: user } = await supabase.auth.getUser();
      targetId = user.user?.id;
    }
    if (!targetId) throw new Error('ユーザーIDが取得できませんでした。');

    const { error } = await supabase
      .from('profiles')
      .update(payload)             // ← payload は bio に null を含んでもOK
      .eq('id', targetId);

    if (error) throw error;

    setProfile(prev => ({ ...(prev || {}), ...payload, id: targetId! }));
    setToast('プロフィールを保存しました');
    setEditOpen(false);
  } catch (e) {
    console.error(e);
    setToast('保存に失敗しました');
  }
}


  return (
    <main className="font-zen">
      {/* ===== Hero / Cover ===== */}
      <section className="relative">
        <div className="h-48 md:h-56 w-full bg-gradient-to-r from-sky-50 to-white" />
        <div className="absolute -bottom-10 left-5 md:left-10 flex items-end gap-4">
          <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100">
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name ?? 'avatar'}
                fill
                className="object-cover"
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
            {profile?.tagline && (
              <p className="text-gray-600 text-sm md:text-base mt-1">{profile.tagline}</p>
            )}
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
                  aria-label="ホームページ"
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
                  aria-label="X (Twitter)"
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
                  aria-label="Instagram"
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
                aria-label="公開URLをコピー"
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
                  aria-label="公開ページを開く"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>公開ページ</span>
                </a>
              )}
              <button
                onClick={() => {
                  const text = `${profile?.display_name ?? 'Artist'} | me-ish ポートフォリオ\n${publicUrl || ''}`;
                  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    text
                  )}&hashtags=me_ish`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                aria-label="Xにシェア"
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

      {/* トースト（簡易） */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 text-white text-sm px-3 py-2 shadow">
          {toast}
        </div>
      )}

      {/* プロフィール編集モーダル */}
      {editOpen && profile && (
        <ProfileEditModal
          initialProfile={{
            display_name: profile.display_name,
            bio: profile.bio || '',
            avatar_url: profile.avatar_url || '',
            banner_url: profile.banner_url || '',
            sns_links: profile.sns_links || {},
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
  const sold = useMemo(() => {
    if (typeof entry.sold === 'boolean') return entry.sold;
    if (isUnlimited(entry)) return false;
    const total = entry.edition_total ?? 0;
    const soldCount = entry.edition_sold ?? 0;
    return total > 0 && soldCount >= total;
  }, [entry]);

  const nft = entry.is_nft || entry.sale_type === 'nft';
  const thumb = entry.image_url || '/placeholder.png';

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition">
      {/* Thumbnail */}
      <div className="relative w-full h-52 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={entry.title}
          className="w-full h-full object-cover group-hover:scale-105 transition"
        />
        {sold && (
          <div className="absolute top-2 left-2 rounded-full bg-black/70 text-white text-xs px-2 py-1">
            SOLD
          </div>
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
                  <span>∞</span>
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
          <a
            href={`/artworks/${entry.id}`}
            className="p-2 rounded-full bg-white hover:bg-gray-100 shadow"
            aria-label="詳細を見る"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            className="p-2 rounded-full bg-white hover:bg-gray-100 shadow"
            aria-label="シェア"
            onClick={() => {
              const base =
                typeof window !== 'undefined' ? window.location.origin : '';
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
            <a
              href={`/downloads/${entry.id}`}
              className="p-2 rounded-full bg-white hover:bg-gray-100 shadow"
              aria-label="ダウンロード（購入者）"
            >
              <Download className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
