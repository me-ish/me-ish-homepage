// C:\me-ish-next\src\components\DesktopHome.tsx
'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  Sparkles,
  ShieldCheck,
  Images,
  ArrowRight,
  ExternalLink,
  Globe,
  Instagram,
  User,
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { supabase } from '@/lib/supabaseClient';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ──────────────────────────────────────────────────────────────
   スクロール時のフェードイン
────────────────────────────────────────────────────────────── */
function useFadeInOnScroll() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('.fade-in-start');
    const callback: IntersectionObserverCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          observer.unobserve(entry.target);
        }
      });
    };
    const observer = new IntersectionObserver(callback, { threshold: 0.2 });
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
}

/* ──────────────────────────────────────────────────────────────
   Special Thanks: 型 & フック
   - Supabase: table "special_thanks"
────────────────────────────────────────────────────────────── */
type ThanksPerson = {
  id: string | number;
  display_name: string;
  avatar_url?: string | null;
  tagline?: string | null;
  homepage_url?: string | null;
  twitter_url?: string | null;
  instagram_url?: string | null;
};

function useSpecialThanks(limit = 24) {
  const [items, setItems] = React.useState<ThanksPerson[]>([]);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('special_thanks')
          .select('id, display_name, avatar_url, tagline, homepage_url, twitter_url, instagram_url')
          .order('display_name', { ascending: true })
          .limit(limit);

        if (error) throw error;

        if (mounted && data && data.length > 0) {
          setItems(data as ThanksPerson[]);
        } else if (mounted) {
          setItems([
            { id: 's1', display_name: 'hanabi', tagline: 'White応募（初期）', twitter_url: 'https://x.com/' },
            { id: 's2', display_name: 'momo', tagline: 'illustrator', homepage_url: 'https://example.com' },
            { id: 's3', display_name: 'ao', tagline: 'digital artist', instagram_url: 'https://instagram.com/' },
          ]);
        }
      } catch {
        if (mounted) {
          setItems([
            { id: 's1', display_name: 'hanabi', tagline: 'White応募（初期）', twitter_url: 'https://x.com/' },
            { id: 's2', display_name: 'momo', tagline: 'illustrator', homepage_url: 'https://example.com' },
            { id: 's3', display_name: 'ao', tagline: 'digital artist', instagram_url: 'https://instagram.com/' },
          ]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [limit]);

  return { items, loading };
}

/* ──────────────────────────────────────────────────────────────
   SNSアイコン（存在するリンクのみ表示）
────────────────────────────────────────────────────────────── */
function SocialIcons({ person }: { person: ThanksPerson }) {
  return (
    <div className="flex items-center gap-3 text-[#00a1e9]">
      {person.homepage_url && (
        <a
          href={person.homepage_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${person.display_name} のホームページ`}
          className="hover:opacity-80"
        >
          <Globe className="w-4 h-4" />
        </a>
      )}
      {person.twitter_url && (
        <a
          href={person.twitter_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${person.display_name} のX（旧Twitter）`}
          className="hover:opacity-80"
        >
          <FaXTwitter className="w-4 h-4" />
        </a>
      )}
      {person.instagram_url && (
        <a
          href={person.instagram_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${person.display_name} のInstagram`}
          className="hover:opacity-80"
        >
          <Instagram className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Special Thanks カード
────────────────────────────────────────────────────────────── */
function ThanksCard({ person }: { person: ThanksPerson }) {
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
              <User className="w-6 h-6 text-[#00a1e9]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#023] truncate">{person.display_name}</p>
          </div>
          {person.tagline && <p className="mt-0.5 text-xs text-[#667] line-clamp-1">{person.tagline}</p>}
          <div className="mt-2">
            <SocialIcons person={person} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ニュース：デスクトップ専用 / フルブリード / 最大3件 / 1行ピル
────────────────────────────────────────────────────────────── */
type AnnouncementItem = {
  id: string | number;
  title: string;
  category: 'info' | 'update' | 'maintenance';
  pinned?: boolean;
  published_at: string;
};

function AnnouncementsStrip({ max = 3 }: { max?: number }) {
  const { items, loading } = useAnnouncements(max + 3);

  const fmt = useMemo(
    () => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    []
  );

  const ordered = useMemo(() => {
    return [...(items as any[])].sort((a: any, b: any) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });
  }, [items]);

  const list = ordered.slice(0, Math.min(max, 3)) as AnnouncementItem[];

  if (loading) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-full border bg-white px-4 py-2 shadow-sm">
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200/70" />
          </li>
        ))}
      </ul>
    );
  }

  if (!list.length) {
    return <div className="rounded-2xl border bg-white p-6 text-sm text-[#667]">現在お知らせはありません。</div>;
  }

  return (
    <ul className="space-y-3" aria-live="polite">
      {list.map((n) => (
        <li key={n.id} className="w-full">
          <div className="flex min-h-[40px] items-center gap-2 rounded-full border bg-white px-4 py-2 shadow-sm">
            <AnnouncementBadgeInline type={n.category} />

            {n.pinned && (
              <Badge variant="secondary" className="shrink-0 bg-rose-100 text-rose-700 hover:bg-rose-100">
                固定
              </Badge>
            )}

            <time
              className="shrink-0 tabular-nums text-xs text-gray-500"
              dateTime={new Date(n.published_at).toISOString()}
              aria-label="公開日"
            >
              {fmt.format(new Date(n.published_at))}
            </time>

            <span className="mx-1 text-gray-300" aria-hidden="true">
              ·
            </span>

            <span className="min-w-0 flex-1 truncate font-medium text-[#023]" title={n.title}>
              {n.title}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AnnouncementBadgeInline({ type }: { type: 'info' | 'update' | 'maintenance' }) {
  const label: Record<string, string> = {
    info: 'Info',
    update: 'Update',
    maintenance: 'Maintenance',
  };

  const cls: Record<string, string> = {
    info: 'border-[#bcdfff]/60 bg-[#e8f4ff] text-[#005a9e]',
    update: 'border-emerald-200 bg-[#eafbea] text-emerald-700',
    maintenance: 'border-rose-200 bg-[#fff1f0] text-rose-700',
  };

  return (
    <Badge variant="outline" className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${cls[type]}`}>
      {label[type]}
    </Badge>
  );
}

/* ──────────────────────────────────────────────────────────────
   ページ本体（ニュースは md 以上のみ表示）
────────────────────────────────────────────────────────────── */
const DesktopHome = () => {
  useFadeInOnScroll();

  return (
    <div className="font-zen text-[#222] bg-white">
      <main className="pt-[70px]">
        {/* Hero */}
        <section
          className="relative flex flex-col items-center justify-center min-h-[82vh] text-center px-6 fade-in-start"
          aria-labelledby="hero-title"
        >
          <div className="pointer-events-none absolute left-0 right-0 top-[-70px] bottom-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,161,233,0.10),_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(0,161,233,0.06),_transparent_60%)]" />
          </div>

          <h1
            id="hero-title"
            className="font-lilita font-bold leading-none text-[#00a1e9] text-[clamp(2.8rem,8vw,5rem)] tracking-tight"
          >
            me-ish
          </h1>
          <p className="text-[#00a1e9]/80 uppercase tracking-[0.22em] mt-2 text-[clamp(0.85rem,1.6vw,1.1rem)]">
            — online gallery —
          </p>
          <p className="mt-8 text-[clamp(1.1rem,2.6vw,1.8rem)] tracking-wide">アートを、もっと近くに</p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/white"
              className="inline-flex items-center gap-2 rounded-full bg-[#00a1e9] px-6 py-3 text-white font-semibold shadow hover:shadow-lg hover:-translate-y-0.5 transition"
              aria-label="ギャラリーを見る"
            >
              ギャラリーを見る <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/entry"
              className="inline-flex items-center gap-2 rounded-full border border-[#00a1e9] px-6 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
              aria-label="応募する"
            >
              応募する <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <a href="modal/about" className="mt-10 text-sm text-[#00a1e9]/70 hover:text-[#00a1e9] transition">
            もっと見る
          </a>
        </section>

        {/* News（デスクトップ専用・フルブリード） */}
        <section
          id="news"
          className="hidden md:block fade-in-start py-8 mx-[calc(50%-50vw)] bg-[#f7fbff]"
          aria-labelledby="news-title"
        >
          <div className="mx-auto w-full max-w-[1040px] px-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="news-title" className="text-[clamp(1.2rem,2.2vw,1.6rem)] font-bold text-[#00a1e9]">
                お知らせ
              </h2>

              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-[#00a1e9] hover:bg-[#e8f7ff]">
                <Link href="/news" aria-label="お知らせ一覧を見る">
                  一覧を見る
                </Link>
              </Button>
            </div>

            <AnnouncementsStrip max={3} />
          </div>
        </section>

        {/* About */}
        <section id="about" className="fade-in-start py-16 px-6 bg-white" aria-labelledby="about-title">
          <div className="max-w-[1040px] mx-auto">
            <h2 id="about-title" className="text-center font-bold mb-10">
              <span className="block text-[clamp(1.8rem,3.8vw,2.6rem)]">
                <span className="text-[#00a1e9] font-lilita">me-ish</span>
                <span className="ml-2 text-[#00a1e9]">とは</span>
              </span>
            </h2>

            <p className="max-w-[820px] mx-auto text-[clamp(1rem,1.6vw,1.15rem)] leading-[1.9] text-center text-[#333]">
              me-ish（ミーイッシュ）は、誰もが自分らしく作品を展示できるオンラインギャラリー。
              作品の“見せ方”と“出会い方”をデザインし、アーティストと鑑賞者の距離を縮めます。
            </p>

            <div className="mt-12 grid gap-6 grid-cols-1 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
                <Sparkles className="h-6 w-6 text-[#00a1e9]" />
                <h3 className="mt-3 font-semibold">作品が映える体験設計</h3>
                <p className="mt-2 text-sm text-[#555] leading-relaxed">
                  3D空間・ホログラム風ラベルなど、me-ish独自のUIで鑑賞体験をアップデート。
                </p>
              </div>
              <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
                <Images className="h-6 w-6 text-[#00a1e9]" />
                <h3 className="mt-3 font-semibold">展示は簡単、応募はスムーズ</h3>
                <p className="mt-2 text-sm text-[#555] leading-relaxed">
                  ガイド付き応募フローで、はじめてでも迷わない。展示後はSOLDやエディション情報も自動で可視化。
                </p>
              </div>
              <div className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow-md transition">
                <ShieldCheck className="h-6 w-6 text-[#00a1e9]" />
                <h3 className="mt-3 font-semibold">画像保護ポリシー</h3>
                <p className="mt-2 text-sm text-[#555] leading-relaxed">
                  ウォーターマークやAI認識阻害処理など、作品保護にも配慮（詳細はポリシーをご確認ください）。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section id="gallery" className="fade-in-start py-16 px-6 bg-[#f9fbfd] text-center" aria-labelledby="gallery-title">
          <h2
            id="gallery-title"
            className="font-bold text-[clamp(1.6rem,3.4vw,2.2rem)] text-[#00a1e9] mb-8"
          >
            ギャラリーを見る
          </h2>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 max-w-[1040px] mx-auto">
            {[
              {
                img: '/images/white-thumb.png',
                title: 'White Gallery',
                desc: '「意識の空間」をイメージした真っ白なギャラリー。10作品限定の特別展示。',
                link: '/white',
              },
              {
                img: '/images/float-thumb.jpg',
                title: 'Float Gallery',
                desc: '“漂う”ように入れ替わる美術館風ギャラリー。日替わりで多彩な作品を展示。',
                link: '/float',
              },
            ].map(({ img, title, desc, link }) => (
              <Link
                key={title}
                href={link}
                aria-label={`${title} へ`}
                className="group block text-left rounded-2xl bg-white shadow-sm ring-1 ring-gray-100
                   hover:shadow-md transition focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-[#00a1e9] focus-visible:ring-offset-2"
              >
                <div className="overflow-hidden rounded-2xl">
                  <Image
                    src={img}
                    alt={`${title} thumbnail`}
                    width={960}
                    height={540}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="w-full h-auto object-cover transition-transform duration-300
                       group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                  />
                </div>

                <div className="p-4 sm:p-5">
                  <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-[13px] sm:text-sm text-[#445] line-clamp-2">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 応募導線 */}
        <section
          id="apply"
          className="fade-in-start relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#dff6ff] via-white to-[#f0f9ff] px-6 py-20 text-center shadow-md transition hover:shadow-xl hover:scale-[1.01] group mx-6 md:mx-auto md:max-w-[1040px]"
          aria-labelledby="apply-title"
        >
          <Link href="/entry" className="absolute inset-0 z-10" aria-label="応募ページへ">
            <span className="sr-only">応募ページへ</span>
          </Link>

          <div className="relative z-20 max-w-xl mx-auto pointer-events-none">
            <h2
              id="apply-title"
              className="text-[clamp(1.5rem,3.2vw,2.2rem)] font-bold text-[#00a1e9] leading-tight mb-3 group-hover:underline underline-offset-4"
            >
              あなたのアートを<br />世界に届けよう
            </h2>
            <p className="text-gray-600 text-[clamp(0.95rem,1.6vw,1.05rem)] mb-6">
              me-ishでは、どなたでも気軽に作品を展示できます。
            </p>
            <div className="inline-block rounded-full bg-[#00a1e9] text-white text-sm sm:text-base font-semibold px-6 py-3 shadow group-hover:bg-[#008ed0] transition">
              応募する
            </div>
          </div>
        </section>

        {/* Special Thanks（見出し自体をリンク化・中央配置） */}
        <section id="special-thanks-link" className="fade-in-start py-10 px-6 bg-white" aria-labelledby="thanks-link-title">
          <div className="max-w-[1040px] mx-auto">
            <div className="rounded-2xl border bg-white p-10 shadow-sm flex flex-col items-center justify-center text-center">
              <h2 id="thanks-link-title" className="text-2xl font-extrabold">
                <Link
                  href="/special-thanks"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent focus:outline-none focus:ring-2 focus:ring-[#00a1e9] focus:ring-offset-2 rounded-lg px-2 py-1"
                  aria-label="Special Thanks ページへ"
                  title="Special Thanks ページへ"
                >
                  <span>✨ Special Thanks ✨</span>
                </Link>
              </h2>

              <p className="mt-2 text-sm text-[#445]">me-ish初期ギャラリー(white)に応募してくださった皆さま</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="fade-in-start py-16 px-6 bg-[#f6f8fb]" aria-labelledby="faq-title">
          <h2
            id="faq-title"
            className="text-center font-bold text-[clamp(1.6rem,3.2vw,2.1rem)] text-[#00a1e9] mb-6"
          >
            よくある質問
          </h2>

          <ul className="max-w-[880px] mx-auto space-y-6 text-[0.96rem] text-[#444]">
            <li className="rounded-xl bg-white/70 border p-5">
              <p className="font-semibold text-[#333]">Q. 誰でも出展できますか？</p>
              <p className="mt-1 leading-relaxed">
                A. はい、プロ・アマ問わずご応募いただけます。展示は<strong>審査制</strong>です。
              </p>
            </li>

            <li className="rounded-xl bg-white/70 border p-5">
              <p className="font-semibold text-[#333]">Q. 出展に料金はかかりますか？</p>
              <p className="mt-1 leading-relaxed">
                A. <strong>応募・展示は無料</strong>です。作品が売れた場合のみ、売上から<strong>手数料</strong>をいただきます。
                詳細はFAQをご確認ください。
              </p>
            </li>

            <li className="rounded-xl bg-white/70 border p-5">
              <p className="font-semibold text-[#333]">Q. 生成AIは使ってもいいですか？</p>
              <p className="mt-1 leading-relaxed">
                A. <strong>AIだけで作った“完全生成”の作品は不可</strong>です。一方で、ラフ作成や構図検討などの
                <strong>補助的な利用</strong>はケースにより扱いが異なります。詳細はFAQをご確認ください。
              </p>
            </li>
          </ul>

          <div className="mt-8 text-center">
            <Button
              asChild
              variant="outline"
              className="rounded-full border-[#00a1e9] text-[#00a1e9] hover:bg-[#e8f7ff]"
            >
              <Link href="/footer/faq" aria-label="よくある質問をもっと見る">
                よくある質問をもっと見る <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="fade-in-start py-16 px-6 bg-white text-center" aria-labelledby="contact-title">
          <h2 id="contact-title" className="font-bold text-[clamp(1.5rem,3vw,2rem)] text-[#00a1e9] mb-4">
            お問い合わせ
          </h2>
          <p className="mb-6 text-[0.98rem]">ご質問・ご相談などございましたら、以下よりご連絡ください。</p>

          <ul className="mt-6 text-[#00a1e9] text-sm space-y-3 max-w-xs mx-auto">
            <li className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              <Link href="/contact" className="hover:underline" aria-label="お問い合わせフォームへ">
                お問い合わせフォームへ
              </Link>
            </li>
            <li className="flex items-center justify-center gap-2">
              <FaXTwitter className="w-4 h-4" />
              <a
                href="https://x.com/meishart0716"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                aria-label="me-ish公式X（旧Twitter）を開く"
              >
                X（旧Twitter）
              </a>
            </li>
          </ul>
        </section>
      </main>

      {/* フェード用の最小スタイル */}
      <style jsx>{`
        .fade-in-start {
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 700ms ease, transform 700ms ease;
        }
        .fade-in-start.show {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default DesktopHome;
