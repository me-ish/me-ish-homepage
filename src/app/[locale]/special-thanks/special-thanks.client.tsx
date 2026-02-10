"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Globe, Instagram, User } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";

type ThanksPerson = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  tagline?: string | null;
  homepage_url?: string | null;
  twitter_url?: string | null;
  instagram_url?: string | null;
};

const isDev = process.env.NODE_ENV !== "production";

// 不正URL/プロトコル漏れ対策： https:// を付与し、URLとして不正なら null
function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  const candidate = u.startsWith("http://") || u.startsWith("https://") ? u : `https://${u}`;
  try {
    const url = new URL(candidate);
    return url.toString();
  } catch {
    return null;
  }
}

export default function SpecialThanksClient() {
  const [items, setItems] = useState<ThanksPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("special_thanks")
          .select(
            "id, display_name, avatar_url, tagline, homepage_url, twitter_url, instagram_url"
          )
          // ※必要なら sort_order / is_public を加える（テーブルに列を用意した後で）
          // .eq("is_public", true)
          .order("display_name", { ascending: true, nullsFirst: false })
          .limit(200);

        if (error) throw error;

        if (!aborted) {
          if (data && data.length) {
            // id を文字列に寄せる（型安定）
            setItems(
              data.map((d) => ({ ...d, id: String(d.id) })) as ThanksPerson[]
            );
          } else {
            // 本番でダミーは出さない
            setItems(
              isDev
                ? [
                    {
                      id: "s1",
                      display_name: "hanabi",
                      tagline: "White応募（初期）",
                      twitter_url: "https://x.com/",
                    },
                    {
                      id: "s2",
                      display_name: "momo",
                      tagline: "illustrator",
                      homepage_url: "https://example.com",
                    },
                    {
                      id: "s3",
                      display_name: "ao",
                      tagline: "digital artist",
                      instagram_url: "https://instagram.com/",
                    },
                  ]
                : []
            );
          }
        }
      } catch {
        if (!aborted) {
          setItems(
            isDev
              ? [
                  {
                    id: "s1",
                    display_name: "hanabi",
                    tagline: "White応募（初期）",
                    twitter_url: "https://x.com/",
                  },
                  {
                    id: "s2",
                    display_name: "momo",
                    tagline: "illustrator",
                    homepage_url: "https://example.com",
                  },
                  {
                    id: "s3",
                    display_name: "ao",
                    tagline: "digital artist",
                    instagram_url: "https://instagram.com/",
                  },
                ]
              : []
          );
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, []);

  if (loading) {
    return (
      <ul
        className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center text-[#567]">
        公開準備中です。応募いただいた皆さまは順次掲載していきます。
      </div>
    );
  }

  return (
    <ul className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3" aria-live="polite">
      {items.map((p) => (
        <li key={p.id}>
          <ThanksCard person={p} />
        </li>
      ))}
    </ul>
  );
}

function ThanksCard({ person }: { person: ThanksPerson }) {
  const homepage = useMemo(() => normalizeUrl(person.homepage_url), [person.homepage_url]);
  const twitter = useMemo(() => normalizeUrl(person.twitter_url), [person.twitter_url]);
  const instagram = useMemo(() => normalizeUrl(person.instagram_url), [person.instagram_url]);

  return (
    <div className="group rounded-2xl border bg-white p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          {person.avatar_url ? (
            <Image
              src={person.avatar_url}
              alt={`${person.display_name}のアバター`}
              fill
              sizes="56px"
              className="rounded-full object-cover"
            />
          ) : (
            <div className="h-full w-full rounded-full bg-[#eaf6fd] flex items-center justify-center">
              <User className="w-6 h-6 text-[#00a1e9]" aria-hidden="true" />
              <span className="sr-only">{person.display_name}のアバター</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#023] truncate">{person.display_name}</p>
          {person.tagline && (
            <p className="mt-0.5 text-xs text-[#667] line-clamp-1">{person.tagline}</p>
          )}

          <div className="mt-2 flex items-center gap-3 text-[#00a1e9]">
            {homepage && (
              <Link
                href={homepage}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${person.display_name} のホームページ`}
                prefetch={false}
                className="hover:opacity-80"
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
              </Link>
            )}
            {twitter && (
              <Link
                href={twitter}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${person.display_name} のX（旧Twitter）`}
                prefetch={false}
                className="hover:opacity-80"
              >
                <FaXTwitter className="w-4 h-4" aria-hidden="true" />
              </Link>
            )}
            {instagram && (
              <Link
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${person.display_name} のInstagram`}
                prefetch={false}
                className="hover:opacity-80"
              >
                <Instagram className="w-4 h-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
