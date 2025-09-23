'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ProfileEditModal from './ProfileEditModal';
import Link from 'next/link';
import {
  LogOut, Pencil, Globe, Instagram, Search, Filter, ExternalLink,
  Heart, Image as Img, ShoppingCart, ArrowUpDown, Download, Share2,
  BadgeCheck, Sparkles, Coins
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

type SNS = { homepage?: string; twitter?: string; instagram?: string };
interface Profile {
  id?: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  sns_links: SNS;
}
interface Entry {
  id: number;
  title: string;
  image_url: string;
  confirmed: boolean;
  created_at: string;
  likes?: number;
  gallery_type?: 'white' | 'float' | null;
  edition_total?: number;
  edition_sold?: number;
  price?: number;
  meish_fee_yen?: number;
  artist_reward_yen?: number;
  confirmed_at?: string;
  display_start_at?: string;
  display_end_at?: string;
}

export default function MyPageClient() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<'new' | 'likes' | 'priceHigh' | 'priceLow'>('new');

useEffect(() => {
  let cancelled = false;

  (async () => {
    setLoading(true);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      router.replace('/login?redirect=/mypage');
      return;
    }
    if (cancelled) return;

    setUserId(user.id);
    setEmail(user.email ?? null);

    const { data: prof0 } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!prof0) {
      await supabase.from('profiles').insert({ id: user.id, display_name: '', sns_links: {} });
    }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!cancelled) setProfile(prof as Profile);

    const { data: entriesData } = await supabase
      .from('entries')
      .select('id, title, image_url, confirmed, created_at, likes, gallery_type, edition_total, edition_sold, price, meish_fee_yen, artist_reward_yen, confirmed_at, display_start_at, display_end_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!cancelled) {
      setEntries(entriesData || []);
      setLoading(false);
    }
  })();

  return () => { cancelled = true; };
}, [router]);


  // メトリクス
  const metrics = useMemo(() => {
    const published = entries.filter(e => e.confirmed && e.image_url?.includes('/final/'));
    const totalLikes = published.reduce((s, e) => s + (e.likes ?? 0), 0);
    const soldCount = published.reduce((s, e) => s + (e.edition_sold ?? 0), 0);
    const reward = published.reduce((s, e) => s + (e.artist_reward_yen ?? 0), 0);
    return {
      publishedCount: published.length,
      totalLikes,
      soldCount,
      rewardYen: reward
    };
  }, [entries]);

  // 検索・並び替え
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = entries.filter(e => e.image_url?.includes('/final/')); // 公開向けに見栄えが良いものだけ
    if (kw) list = list.filter(e => e.title?.toLowerCase().includes(kw));
    switch (sortKey) {
      case 'likes':
        list = [...list].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        break;
      case 'priceHigh':
        list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case 'priceLow':
        list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      default:
        list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return list;
  }, [entries, q, sortKey]);

  // CSVエクスポート
  const exportCSV = () => {
    const rows = [
      ['id', 'title', 'confirmed', 'created_at', 'likes', 'gallery', 'edition_total', 'edition_sold', 'price_yen', 'artist_reward_yen', 'meish_fee_yen', 'confirmed_at', 'display_start_at', 'display_end_at'],
      ...entries.map(e => [
        e.id,
        safe(e.title),
        e.confirmed ? 'true' : 'false',
        e.created_at,
        e.likes ?? 0,
        e.gallery_type ?? '',
        e.edition_total ?? '',
        e.edition_sold ?? '',
        e.price ?? '',
        e.artist_reward_yen ?? '',
        e.meish_fee_yen ?? '',
        e.confirmed_at ?? '',
        e.display_start_at ?? '',
        e.display_end_at ?? '',
      ])
    ]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'me-ish_entries.csv';
    a.click();
    URL.revokeObjectURL(url);
    setToast('CSVをエクスポートしました');
  };

  const copyProfileLink = async () => {
    try {
      const url = `${window.location.origin}/artist/${profile?.id ?? userId ?? ''}`;
      await navigator.clipboard.writeText(url);
      setToast('プロフィールURLをコピーしました');
    } catch {
      setToast('コピーに失敗しました');
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace('/login?redirect=/mypage');
  };

  return (
    <>
      {/* トースト */}
      {toast && (
        <div className="fixed top-4 right-4 z-[999] rounded-lg bg-[#111]/90 text-white px-4 py-2 shadow">
          {toast}
        </div>
      )}

      {/* 編集モーダル */}
      {editing && profile && (
        <ProfileEditModal
          initialProfile={profile}
          onCancel={() => setEditing(false)}
          onSave={async (updated) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const payload = {
              display_name: updated.display_name ?? '',
              bio: (updated as any).bio ?? profile.bio ?? '',
              avatar_url: (updated as any).avatar_url ?? profile.avatar_url ?? '',
              banner_url: (updated as any).banner_url ?? profile.banner_url ?? '',
              sns_links: {
                homepage: updated.sns_links?.homepage ?? '',
                twitter: updated.sns_links?.twitter ?? '',
                instagram: updated.sns_links?.instagram ?? '',
              } as SNS,
            };
            const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
            if (!error) {
              setProfile(prev => ({ ...(prev || {}), ...payload }));
              setEditing(false);
              setToast('プロフィールを更新しました');
            } else {
              console.error(error);
              setToast('保存に失敗しました');
            }
          }}
        />
      )}

      <main className="min-h-screen bg-gradient-to-b from-white to-[#f6fbff]">
        {/* ヒーロー（バナー＋アバター） */}
        <section className="relative">
          <div
            className="h-40 w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e8f7ff] via-white to-white"
            style={{
              backgroundImage: profile?.banner_url ? `url(${profile.banner_url})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="max-w-5xl mx-auto px-6">
            <div className="-mt-10 flex items-end justify-between">
              <div className="flex items-end gap-4">
                <div className="h-20 w-20 rounded-full ring-4 ring-white bg-[#e6eef6] overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-[#7aaad1]">🎨</div>
                  )}
                </div>
                <div className="pb-2">
                  <h1 className="text-2xl font-semibold text-[#222]">
                    {profile?.display_name || email || 'アーティスト'}
                  </h1>
                  <p className="text-sm text-[#667] max-w-xl line-clamp-2">
                    {profile?.bio || '自己紹介文を追加して、ポートフォリオの印象を高めましょう。'}
                  </p>
                  {/* SNS */}
                  <div className="mt-1 flex items-center gap-3 text-[#445]">
                    {profile?.sns_links?.homepage && (
                      <a href={profile.sns_links.homepage} target="_blank" rel="noopener noreferrer" title="ホームページ" className="hover:opacity-80">
                        <Globe className="w-4 h-4" />
                      </a>
                    )}
                    {profile?.sns_links?.twitter && (
                      <a href={profile.sns_links.twitter} target="_blank" rel="noopener noreferrer" title="X (Twitter)" className="hover:opacity-80">
                        <FaXTwitter className="w-4 h-4" />
                      </a>
                    )}
                    {profile?.sns_links?.instagram && (
                      <a href={profile.sns_links.instagram} target="_blank" rel="noopener noreferrer" title="Instagram" className="hover:opacity-80">
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* アクション */}
              <div className="flex items-center gap-2 pb-2">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d9e6f2] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f7fbff] transition"
                >
                  <Pencil className="w-4 h-4 text-[#00a1e9]" /> プロフィール編集
                </button>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-full bg-[#ffefef] border border-[#ffd7d7] px-4 py-2 text-sm font-semibold text-[#9b1c1c] hover:bg-[#ffe7e7] transition"
                >
                  <LogOut className="w-4 h-4" /> ログアウト
                </button>
              </div>
            </div>

            {/* 公開リンク（ポートフォリオ土台） */}
            <div className="mt-4 rounded-2xl border bg-white p-4 flex flex-wrap items-center gap-3">
              <div className="text-sm text-[#445]">
                <span className="font-semibold">公開プロフィール（β）</span><br />
                <span className="text-xs text-[#667]">このURLを名刺やSNSに掲載できます（今後、専用公開ページを拡充予定）。</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <code className="text-xs bg-[#f6f8fb] border px-2 py-1 rounded">{typeof window !== 'undefined' ? `${window.location.origin}/artist/${profile?.id ?? userId ?? ''}` : '/artist/...'}</code>
                <button
                  onClick={copyProfileLink}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d9e6f2] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f7fbff]"
                >
                  <Share2 className="w-4 h-4 text-[#00a1e9]" /> コピー
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* メトリクス */}
        <section className="max-w-5xl mx-auto px-6 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={<Img className="w-4 h-4" />} label="展示中" value={`${metrics.publishedCount} 点`} />
            <MetricCard icon={<Heart className="w-4 h-4" />} label="いいね" value={`${metrics.totalLikes}`} />
            <MetricCard icon={<ShoppingCart className="w-4 h-4" />} label="販売数" value={`${metrics.soldCount}`} />
            <MetricCard icon={<Coins className="w-4 h-4" />} label="推定報酬" value={`¥${(metrics.rewardYen || 0).toLocaleString()}`} />
          </div>
        </section>

        {/* ツールバー */}
        <section className="max-w-5xl mx-auto px-6 mt-6">
          <div className="rounded-2xl border bg-white p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#889]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="作品名で検索"
                className="w-full pl-9 pr-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#889]" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
              >
                <option value="new">新しい順</option>
                <option value="likes">いいね順</option>
                <option value="priceHigh">価格（高い順）</option>
                <option value="priceLow">価格（安い順）</option>
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/entry"
                className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-4 py-2 text-white text-sm font-semibold hover:brightness-[1.05]"
              >
                <Sparkles className="w-4 h-4" /> 新しい作品を応募
              </Link>
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 rounded-full border border-[#d9e6f2] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f7fbff]"
              >
                <Download className="w-4 h-4 text-[#00a1e9]" /> CSV出力
              </button>
            </div>
          </div>
        </section>

        {/* 作品グリッド */}
        <section className="max-w-5xl mx-auto px-6 mt-4 pb-16">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-72 rounded-2xl bg-[#f6f8fb] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map((e) => (
                <ArtworkCard key={e.id} e={e} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

/* ---------- Components ---------- */

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-[#667]">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[#00a1e9]">{icon}</span>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ArtworkCard({ e }: { e: Entry }) {
  const status = e.confirmed ? '承認済' : '承認待ち';
  const statusCls = e.confirmed ? 'bg-[#e8fff1] text-[#0d7a3e] border-[#b9f0cf]' : 'bg-[#fff8e8] text-[#8a5b00] border-[#ffe2a9]';
  const galleryLabel = e.gallery_type === 'white' ? 'White' : e.gallery_type === 'float' ? 'Float' : '未定';

  const galleryHref =
    e.gallery_type === 'white' ? '/white' :
    e.gallery_type === 'float' ? '/float' : '#';

  return (
    <div className="group rounded-2xl border bg-white overflow-hidden hover:shadow-lg transition">
      <div className="aspect-[4/3] bg-[#f6f8fb]">
        {e.image_url ? (
          <img src={e.image_url} alt={e.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full grid place-items-center text-[#99a]">No Image</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-tight line-clamp-2">{e.title}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusCls}`}>{status}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#445]">
          <div className="rounded-lg bg-[#f6f8fb] px-2 py-1">いいね ❤ {e.likes ?? 0}</div>
          <div className="rounded-lg bg-[#f6f8fb] px-2 py-1">ギャラリー {galleryLabel}</div>
          <div className="rounded-lg bg-[#f6f8fb] px-2 py-1">
            エディション {e.edition_total ?? 0} 中 {(e.edition_total ?? 0) - (e.edition_sold ?? 0)} 残
          </div>
          <div className="rounded-lg bg-[#f6f8fb] px-2 py-1">
            価格 {e.price != null ? `¥${e.price.toLocaleString()}` : '—'}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[11px] text-[#667]">
            {e.confirmed_at && <span className="mr-2">承認 {toJP(e.confirmed_at)}</span>}
            {e.display_start_at && <span className="mr-2">開始 {toJP(e.display_start_at)}</span>}
            {e.display_end_at && <span>終了 {toJP(e.display_end_at)}</span>}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={galleryHref}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full border border-[#d9e6f2] px-2.5 py-1 text-xs hover:bg-[#f7fbff]"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#00a1e9]" /> ギャラリーで見る
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-10 text-center">
      <p className="text-[#445]">まだ作品がありません。</p>
      <Link
        href="/entry"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-4 py-2 text-white text-sm font-semibold hover:brightness-[1.05]"
      >
        <BadgeCheck className="w-4 h-4" /> 最初の作品を応募
      </Link>
    </div>
  );
}

/* ---------- utils ---------- */
function safe(s?: string) {
  return (s ?? '').replace(/\n/g, ' ').trim();
}
function toJP(d?: string) {
  try {
    return new Date(d as string).toLocaleDateString('ja-JP');
  } catch {
    return '';
  }
}

