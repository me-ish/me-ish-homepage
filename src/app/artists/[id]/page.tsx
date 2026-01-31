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
  // 霑泌唆縺ｫ蜷ｫ縺ｾ繧後※繧・UI 縺ｧ縺ｯ菴ｿ繧上↑縺・Φ螳壹□縺後∝梛蟠ｩ繧碁亟豁｢縺ｧ optional
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

        // 迚ｹ萓・ /artists/me 縺ｯ閾ｪ蛻・・id縺ｫ繝ｪ繝繧､繝ｬ繧ｯ繝・
        if (id === 'me') {
          const { data } = await supabase.auth.getUser();
          if (data.user?.id) {
            router.replace(`/artists/${data.user.id}`);
            return;
          }
        }

        // 繝励Ο繝輔ぅ繝ｼ繝ｫ・亥・髢九・繝ｼ繧ｸ縺ｯ profiles 縺ｮ蜈ｬ髢矩・岼縺ｮ縺ｿ陦ｨ遉ｺ・・
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

        // 笨・蜈ｬ髢九・繝ｼ繝医ヵ繧ｩ繝ｪ繧ｪ・・ettings + entries・峨ｒ RPC 縺九ｉ蜿門ｾ・
        const { data: pub, error: pubErr } = await supabase.rpc(
          'get_public_portfolio',
          { p_user_id: id }
        );

        if (pubErr) {
          // 螳溯｣・比ｸｭ/讓ｩ髯仙捉繧翫〒關ｽ縺｡繧句庄閭ｽ諤ｧ縺後≠繧九・縺ｧ繝ｭ繧ｰ縺縺大・縺励※縲碁撼蜈ｬ髢区桶縺・阪↓蛟偵☆
          console.error('[get_public_portfolio] error:', pubErr);
          setIsPrivate(true);
          setEntries([]);
          return;
        }

        const result = (pub as PublicPortfolioResult) ?? null;

        if (!result) {
          // is_public=false 遲峨〒 null 縺瑚ｿ斐ｋ諠ｳ螳・
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
    return <main className="px-4 py-16 text-gray-500">隱ｭ縺ｿ霎ｼ縺ｿ荳ｭ...</main>;
  }

  if (notFound || !profile) {
    return (
      <main className="px-4 py-16 text-gray-500">
        縺薙・繧｢繝ｼ繝・ぅ繧ｹ繝医・隕九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆縲・
      </main>
    );
  }

  const bannerFocusX = profile.banner_focus_x ?? 0.5;
  const bannerFocusY = profile.banner_focus_y ?? 0.5;
  const bannerZoom = profile.banner_zoom ?? 1;

  if (isPrivate) {
    return (
      <main className="font-zen">
        {/* 繝倥ャ繝繝ｼ・医ユ繝ｳ繝励Ξ縺ｮ髮ｰ蝗ｲ豌励・谿九☆・・*/}
                        <section className="relative">
          <div className="px-4 md:px-6">
            <div className="mx-auto w-full max-w-6xl">
              <div className="relative w-full aspect-[16/5] overflow-hidden rounded-2xl">
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
                      側
                    </div>
                  )}
                </div>
                <div className="pb-2">
                  <h1 className="font-lilita text-2xl md:text-3xl tracking-wide">
                    {profile.display_name}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 px-4 md:px-6 mb-20">
          <div className="rounded-2xl border bg-white p-6 text-gray-700">
            <p className="font-medium">縺薙・繝昴・繝医ヵ繧ｩ繝ｪ繧ｪ縺ｯ髱槫・髢九〒縺吶・/p>
            <p className="text-sm text-gray-500 mt-2">
              蜈ｬ髢玖ｨｭ螳壹・繝槭う繝壹・繧ｸ縺ｮ縲後・繝ｼ繝医ヵ繧ｩ繝ｪ繧ｪ險ｭ螳壹阪°繧牙､画峩縺ｧ縺阪∪縺吶・
            </p>
            <div className="mt-4">
              <Link
                href="/mypage"
                className="inline-flex items-center rounded-full border px-4 py-2 text-sm hover:bg-gray-50"
              >
                繝槭う繝壹・繧ｸ縺ｸ謌ｻ繧・
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="font-zen">
      {/* 繝倥ャ繝繝ｼ */}
                      <section className="relative">
          <div className="px-4 md:px-6">
            <div className="mx-auto w-full max-w-6xl">
              <div className="relative w-full aspect-[16/5] overflow-hidden rounded-2xl">
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
                      側
                    </div>
                  )}
                </div>
                <div className="pb-2">
                  <h1 className="font-lilita text-2xl md:text-3xl tracking-wide">
                    {profile.display_name}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </section>

      {/* 繝励Ο繝輔ぅ繝ｼ繝ｫ */}
      <section className="mt-16 px-4 md:px-6">
        <div className="rounded-2xl border bg-white p-4 md:p-6">
          <p className="text-gray-700 leading-relaxed md:max-w-3xl">
            {profile.bio || '繝励Ο繝輔ぅ繝ｼ繝ｫ縺ｯ縺ｾ縺譖ｸ縺九ｌ縺ｦ縺・∪縺帙ｓ縲・}
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

      {/* 菴懷刀荳隕ｧ */}
      <section className="px-3 sm:px-6 lg:px-10 mt-8 mb-24">
        {entries.length === 0 ? (
          <div className="grid place-items-center py-16 text-gray-500">
            蜈ｬ髢倶ｸｭ縺ｮ菴懷刀縺ｯ縺ｾ縺縺ゅｊ縺ｾ縺帙ｓ縲・
          </div>
        ) : entries.length === 1 ? (
          // 笨・1譫壹・縺ｨ縺阪・ 窶懈ｨｪ縺ｫ蠎・￥窶・隕九○繧・
          <div className="max-w-6xl mx-auto">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/artworks/${e.id}`}
                className="group relative block overflow-hidden rounded-3xl bg-white border shadow-sm hover:shadow-md transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.image_url}
                  alt={e.title ?? "artwork"}
                  className="w-full h-[280px] sm:h-[360px] md:h-[460px] lg:h-[520px] object-cover group-hover:scale-[1.02] transition"
                />

                {/* 繧ｿ繧､繝医Ν縺ｯ逕ｻ蜒丈ｸ九↓螟ｧ縺阪ａ */}
                <div className="p-4 sm:p-5">
                  <h3 className="font-semibold text-gray-900 text-base sm:text-lg truncate">
                    {e.title ?? "Untitled"}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          // 笨・隍・焚譫壹・繧ｰ繝ｪ繝・ラ・・譫壹≠縺溘ｊ繧ょｰ代＠螟ｧ縺阪ａ・・
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/artworks/${e.id}`}
                className="group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-md transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.image_url}
                  alt={e.title ?? "artwork"}
                  className="w-full h-64 sm:h-72 object-cover group-hover:scale-105 transition"
                />
                <div className="p-3.5">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {e.title ?? "Untitled"}
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




