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

type Entry = {
  id: number;
  title: string;
  image_url: string;
  confirmed: boolean;
  likes?: number | null;
  price?: number | null;
  gallery_type?: string | null;
  sale_type?: 'normal' | 'nft' | null;
  edition_total?: number | null;
  edition_sold?: number | null;
  is_sold?: boolean | null;
};

export default function ArtistPublicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // 特例: /artists/me は自分のidにリダイレクト
        if (id === 'me') {
          const { data } = await supabase.auth.getUser();
          if (data.user?.id) {
            router.replace(`/artists/${data.user.id}`);
            return;
          }
        }

        // プロフィール（idで取得）
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, banner_url, bio, sns_links')
          .eq('id', id)
          .maybeSingle<Profile>();

        if (profErr) throw profErr;

        setProfile(prof ?? null);

        // 作品（公開済みのみ）
        const { data: es, error: esErr } = await supabase
          .from('entries')
          .select(
            'id, title, image_url, confirmed, likes, price, gallery_type, sale_type, edition_total, edition_sold, is_sold'
          )
          .eq('user_id', id)
          .eq('confirmed', true)
          .order('created_at', { ascending: false })
          .returns<Entry[]>();

        if (esErr) throw esErr;
        setEntries(es ?? []);
      } catch (e) {
        console.error(e);
        setProfile(null);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return <main className="px-4 py-16 text-gray-500">読み込み中...</main>;
  }

  if (!profile) {
    return <main className="px-4 py-16 text-gray-500">このアーティストは見つかりませんでした。</main>;
  }

  return (
    <main className="font-zen">
      {/* ヘッダー */}
      <section className="relative">
        <div className="relative h-48 md:h-56 w-full overflow-hidden">
          {profile.banner_url ? (
            <Image src={profile.banner_url} alt="banner" fill className="object-cover" unoptimized />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-sky-50 to-white" />
          )}
        </div>
        <div className="absolute -bottom-10 left-5 md:left-10 flex items-end gap-4">
          <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full ring-4 ring-white overflow-hidden bg-gray-100">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full grid place-items-center text-gray-400">👤</div>
            )}
          </div>
          <div className="pb-2">
            <h1 className="font-lilita text-2xl md:text-3xl tracking-wide">{profile.display_name}</h1>
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
              <a className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50" href={profile.sns_links.homepage} target="_blank" rel="noreferrer">
                Website
              </a>
            )}
            {profile.sns_links?.twitter && (
              <a className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50" href={profile.sns_links.twitter} target="_blank" rel="noreferrer">
                X
              </a>
            )}
            {profile.sns_links?.instagram && (
              <a className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50" href={profile.sns_links.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
          </div>
        </div>
      </section>

      {/* 作品一覧 */}
      <section className="px-4 md:px-6 mt-6 mb-20">
        {entries.length === 0 ? (
          <div className="grid place-items-center py-16 text-gray-500">公開中の作品はまだありません。</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {entries.map((e) => (
              <Link key={e.id} href={`/artworks/${e.id}`} className="group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.image_url} alt={e.title} className="w-full h-52 object-cover group-hover:scale-105 transition" />
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 truncate">{e.title}</h3>
                  <p className="text-sm text-gray-500">{e.sale_type === 'nft' ? 'NFT' : '通常'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
