// src/app/artists/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { EyeOff, Lock } from 'lucide-react';

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
  title: string;
  image_url: string;
  likes: number;
};

type PublicPortfolioData = {
  settings: {
    is_public: boolean;
    works_filter: 'displaying' | 'for_sale' | 'all';
    sort_key: 'new' | 'likes';
  };
  profile: Profile;
  entries: PublicEntry[];
};

export default function ArtistPublicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicPortfolioData | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setIsPrivate(false);
        setNotFound(false);

        // 特例: /artists/me は自分のidにリダイレクト
        if (id === 'me') {
          const { data: authData } = await supabase.auth.getUser();
          if (authData.user?.id) {
            router.replace(`/artists/${authData.user.id}`);
            return;
          }
        }

        // 公開関数を呼び出し
        const { data: result, error } = await supabase.rpc('get_public_portfolio', {
          p_user_id: id,
        });

        if (error) {
          console.error('[ArtistPublicPage] rpc error:', error);
          setNotFound(true);
          return;
        }

        // null = 非公開 or 存在しない
        if (!result) {
          // プロフィールだけ取得して存在確認
          const { data: prof } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', id)
            .maybeSingle();

          if (prof) {
            // ユーザーは存在するが非公開
            setIsPrivate(true);
          } else {
            // ユーザーが存在しない
            setNotFound(true);
          }
          return;
        }

        // 公開データをセット
        setData(result as PublicPortfolioData);
      } catch (e) {
        console.error('[ArtistPublicPage] error:', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <EyeOff className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            このアーティストは見つかりませんでした
          </h1>
          <p className="text-gray-500 mb-6">
            URLが間違っているか、ページが削除された可能性があります。
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-5 py-2.5 text-white font-medium hover:brightness-105 transition"
          >
            トップページへ
          </Link>
        </div>
      </main>
    );
  }

  if (isPrivate) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <Lock className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            このポートフォリオは非公開です
          </h1>
          <p className="text-gray-500 mb-6">
            アーティストがポートフォリオを公開設定にすると閲覧できます。
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-5 py-2.5 text-white font-medium hover:brightness-105 transition"
          >
            トップページへ
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  const { profile, entries } = data;

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
              <div className="w-full h-full grid place-items-center text-gray-400">👤</div>
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
          <div className="mt-4 flex items-center gap-2">
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
                href={`/works/${e.id}`}
                className="group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.image_url}
                  alt={e.title}
                  className="w-full h-52 object-cover group-hover:scale-105 transition"
                />
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 truncate">{e.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
