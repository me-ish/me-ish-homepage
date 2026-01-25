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
  // 返却に含まれても UI では使わない想定だが、型崩れ防止で optional
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

        // プロフィール（公開ページは profiles の公開項目のみ表示）
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, banner_url, bio, sns_links')
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

        // ✅ 公開ポートフォリオ（settings + entries）を RPC から取得
        const { data: pub, error: pubErr } = await supabase.rpc(
          'get_public_portfolio',
          { p_user_id: id }
        );

        if (pubErr) {
          // 実装途中/権限周りで落ちる可能性があるのでログだけ出して「非公開扱い」に倒す
          console.error('[get_public_portfolio] error:', pubErr);
          setIsPrivate(true);
          setEntries([]);
          return;
        }

        const result = (pub as PublicPortfolioResult) ?? null;

        if (!result) {
          // is_public=false 等で null が返る想定
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
    return <main className="px-4 py-16 text-gray-500">読み込み中...</main>;
  }

  if (notFound || !profile) {
    return (
      <main className="px-4 py-16 text-gray-500">
        このアーティストは見つかりませんでした。
      </main>
    );
  }

  if (isPrivate) {
    return (
      <main className="font-zen">
        {/* ヘッダー（テンプレの雰囲気は残す） */}
        <section className="relative">
          <div className="relative h-48 md:h-56 w-full overflow-hidden">
            {profile.banner_url ? (
              <Image
                src={profile.banner_url}
                alt="banner"
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
            )}
          </div>

          <div className="absolute -bottom-10 left-5 md:left-10 flex items-end gap-4">
            <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100">
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
                  👤
                </div>
              )}
            </div>
            <div className="pb-2">
              <h1 className="font-lilita text-2xl md:text-3xl tracking-wide">
                {profile.display_name}
              </h1>
            </div>
          </div>
        </section>

        <section className="mt-16 px-4 md:px-6 mb-20">
          <div className="rounded-2xl border bg-white p-6 text-gray-700">
            <p className="font-medium">このポートフォリオは非公開です。</p>
            <p className="text-sm text-gray-500 mt-2">
              公開設定はマイページの「ポートフォリオ設定」から変更できます。
            </p>
            <div className="mt-4">
              <Link
                href="/mypage"
                className="inline-flex items-center rounded-full border px-4 py-2 text-sm hover:bg-gray-50"
              >
                マイページへ戻る
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="font-zen">
      {/* ヘッダー */}
      <section className="relative">
        <div className="relative h-48 md:h-56 w-full overflow-hidden">
          {profile.banner_url ? (
            <Image
              src={profile.banner_url}
              alt="banner"
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
          )}
        </div>

        <div className="absolute -bottom-10 left-5 md:left-10 flex items-end gap-4">
          <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100">
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
                👤
              </div>
            )}
          </div>
          <div className="pb-2">
            <h1 className="font-lilita text-2xl md:text-3xl tracking-wide">
              {profile.display_name}
            </h1>
          </div>
        </div>
      </section>

      {/* プロフィール */}
      <section className="mt-16 px-4 md:px-6">
        <div className="rounded-2xl border bg-white p-4 md:p-6">
          <p className="text-gray-700 leading-relaxed md:max-w-3xl">
            {profile.bio || 'プロフィールはまだ書かれていません。'}
          </p>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {profile.sns_links?.homepage && (
              <a
                className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
                href={profile.sns_links.homepage}
                target="_blank"
                rel="noreferrer"
              >
                Website
              </a>
            )}
            {profile.sns_links?.twitter && (
              <a
                className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
                href={profile.sns_links.twitter}
                target="_blank"
                rel="noreferrer"
              >
                X
              </a>
            )}
            {profile.sns_links?.instagram && (
              <a
                className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
                href={profile.sns_links.instagram}
                target="_blank"
                rel="noreferrer"
              >
                Instagram
              </a>
            )}
          </div>
        </div>
      </section>

      {/* 作品一覧 */}
      <section className="px-4 md:px-6 mt-6 mb-20">
        {entries.length === 0 ? (
          <div className="grid place-items-center py-16 text-gray-500">
            公開中の作品はまだありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/artworks/${e.id}`}
                className="group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.image_url}
                  alt={e.title ?? 'artwork'}
                  className="w-full h-52 object-cover group-hover:scale-105 transition"
                />
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 truncate">
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
