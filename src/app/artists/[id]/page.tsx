// src/app/artists/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  banner_focus_x?: number | null;
  banner_focus_y?: number | null;
  banner_zoom?: number | null;
  bio?: string | null;
  sns_links?: { homepage?: string; twitter?: string; instagram?: string } | null;
};

type PublicEntry = {
  id: number;
  title: string | null;
  image_url: string;
  likes?: number | null;
  price?: number | null;
  gallery_type?: string | null;
  edition_total?: number | null;
  edition_sold?: number | null;
  is_sold?: boolean | null;
};

type PublicPortfolioResult = {
  settings: {
    user_id: string;
    is_public: boolean;
    works_filter?: 'displaying' | 'for_sale' | 'all';
    sort_key?: 'new' | 'likes';
  };
  entries: PublicEntry[];
} | null;

export default function ArtistPublicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<PublicEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setNotFound(false);
        setIsPrivate(false);

        // 特例: /artists/me は自分のidにリダイレクト
        if (id === 'me') {
          const { data } = await supabase.auth.getUser();
          if (data.user?.id) {
            router.replace(`/artists/${data.user.id}`);
            return;
          }
        }

        // プロフィール取得
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select(
            'id, display_name, avatar_url, banner_url, banner_focus_x, banner_focus_y, banner_zoom, bio, sns_links'
          )
          .eq('id', id)
          .maybeSingle<Profile>();

        if (profErr) throw profErr;
        if (!prof) {
          setNotFound(true);
          setProfile(null);
          setEntries([]);
          return;
        }
        setProfile(prof ?? null);

        // 公開ポートフォリオ取得
        const { data: pub, error: pubErr } = await supabase.rpc(
          'get_public_portfolio',
          { p_user_id: id }
        );

        if (pubErr) {
          console.error('[get_public_portfolio] error:', pubErr);
          setIsPrivate(true);
          setEntries([]);
          return;
        }

        const result = (pub as PublicPortfolioResult) ?? null;

        if (!result) {
          setIsPrivate(true);
          setEntries([]);
          return;
        }

        setEntries(Array.isArray(result.entries) ? result.entries : []);
      } catch (e) {
        console.error(e);
        setProfile(null);
        setEntries([]);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return (
      <main className="font-zen">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-16 text-gray-500">
          読み込み中...
        </div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="font-zen">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-16 text-gray-500">
          このアーティストは見つかりませんでした。
        </div>
      </main>
    );
  }

  const bannerFocusX = profile.banner_focus_x ?? 0.5;
  const bannerFocusY = profile.banner_focus_y ?? 0.5;
  const bannerZoom = profile.banner_zoom ?? 1;

  if (isPrivate) {
    return (
      <main className="font-zen">
        <section className="relative">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="relative w-full aspect-[16/5] overflow-hidden rounded-3xl border bg-white shadow-sm">
              {profile.banner_url ? (
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
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
                )}
              </div>

            <div className="relative -mt-8 md:-mt-10 flex items-end gap-4">
              <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100 shadow-sm">
                {profile.avatar_url ? (
                  <Image
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-gray-400">
                      ?
                    </div>
                  )}
                </div>
              <div className="pb-2">
                <h1 className="font-lilita text-2xl md:text-3xl tracking-wide text-gray-900">
                  {profile.display_name}
                </h1>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 md:mt-14 mb-20">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <div className="rounded-3xl border bg-white p-6 md:p-8 text-gray-700 shadow-sm">
            <p className="font-medium">このポートフォリオは非公開です。</p>
            <p className="text-sm text-gray-500 mt-2">
              公開設定はマイページの「ポートフォリオ設定」から変更できます。
            </p>
            <div className="mt-4">
              <Link
                href="/mypage"
                className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                マイページへ戻る
              </Link>
            </div>
          </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="font-zen">
      <section className="relative">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <div className="relative w-full aspect-[16/5] overflow-hidden rounded-3xl border bg-white shadow-sm">
              {profile.banner_url ? (
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
                  unoptimized
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
              )}
            </div>

          <div className="relative -mt-8 md:-mt-10 flex items-end gap-4">
            <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100 shadow-sm">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-gray-400">
                    ?
                  </div>
                )}
              </div>
            <div className="pb-2">
              <h1 className="font-lilita text-2xl md:text-3xl tracking-wide text-gray-900">
                {profile.display_name}
              </h1>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 md:mt-14">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <div className="rounded-3xl border bg-white p-5 md:p-7 shadow-sm">
            <p className="text-gray-700 leading-relaxed md:max-w-3xl">
            {profile.bio || 'プロフィールはまだ記載されていません。'}
          </p>

            <div className="mt-5 flex items-center gap-2 flex-wrap">
              {profile.sns_links?.homepage && (
                <a
                  className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  href={profile.sns_links.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Website
                </a>
              )}
              {profile.sns_links?.twitter && (
                <a
                  className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  href={profile.sns_links.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  X
                </a>
              )}
              {profile.sns_links?.instagram && (
                <a
                  className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  href={profile.sns_links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-3 sm:px-6 lg:px-10 mt-10 mb-24">
        {entries.length === 0 ? (
          <div className="grid place-items-center py-16 text-gray-500">
            公開中の作品はありません。
          </div>
        ) : entries.length === 1 ? (
          <div className="max-w-6xl mx-auto">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/artworks/${e.id}`}
                className="group relative block rounded-3xl bg-white border shadow-sm hover:shadow-md transition"
              >
                <div className="relative w-full h-[280px] sm:h-[360px] md:h-[460px] lg:h-[520px] overflow-hidden rounded-3xl">
                  <Image
                    src={e.image_url}
                    alt={e.title ?? 'artwork'}
                    fill
                    className="object-cover group-hover:scale-[1.02] transition"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 80vw, 1200px"
                    unoptimized
                  />
                </div>

                <div className="p-5 sm:p-6">
                  <h3 className="font-semibold text-gray-900 text-base sm:text-lg truncate">
                    {e.title ?? 'Untitled'}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-7">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/artworks/${e.id}`}
                className="group relative rounded-3xl bg-white border shadow-sm hover:shadow-md transition"
              >
                <div className="relative w-full h-64 sm:h-72 overflow-hidden rounded-3xl">
                  <Image
                    src={e.image_url}
                    alt={e.title ?? 'artwork'}
                    fill
                    className="object-cover group-hover:scale-[1.03] transition"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    unoptimized
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {e.title ?? 'Untitled'}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
