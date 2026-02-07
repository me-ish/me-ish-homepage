'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  Images,
  Sparkles,
  Palette,
  Eye,
  Users,
  ChevronUp,
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { supabase } from '@/lib/supabaseClient';
import { resolveImageUrl, type EntryRow } from '@/lib/gallery/galleryUtils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { FloatingBubbles } from '@/components/shared/FloatingBubbles';

// Layout Tokens
const LAYOUT = {
  container: 'mx-auto w-full max-w-[680px]',
  sectionX: 'px-5',
  sectionY: 'py-12',
  sectionYCompact: 'py-8',
} as const;

// モバイル用の浮遊アート配置パターン（少なめ・小さめ）
const FLOATING_POSITIONS_MOBILE = [
  { x: 5, y: 8, size: 65, delay: 0 },
  { x: 82, y: 12, size: 55, delay: 0.4 },
  { x: 6, y: 68, size: 50, delay: 0.8 },
  { x: 80, y: 72, size: 58, delay: 1.2 },
];

// ギャラリー統計を取得するフック
function useGalleryStats() {
  const [stats, setStats] = useState<{ worksCount: number; artistsCount: number } | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('user_id')
          .eq('confirmed', true)
          .eq('display_ready', true);

        if (error) throw error;

        if (mounted && data) {
          const worksCount = data.length;
          const uniqueArtists = new Set(data.map((entry) => entry.user_id));
          setStats({
            worksCount,
            artistsCount: uniqueArtists.size,
          });
        }
      } catch (err) {
        console.error('Failed to fetch gallery stats:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return stats;
}

// 展示作品を取得するフック（Hero表示用：agree_promotion=true のみ）
function useGalleryArtworks(limit = 4) {
  const [artworks, setArtworks] = useState<{ src: string; id: number }[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Hero表示は公式広報への同意（agree_promotion）がある作品のみ
        const { data, error } = await supabase
          .from('entries')
          .select('id, image_url, file_name')
          .eq('confirmed', true)
          .eq('display_ready', true)
          .eq('agree_promotion', true)
          .order('confirmed_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        if (mounted && data && data.length > 0) {
          const resolved = data
            .map((entry) => ({
              id: entry.id,
              src: resolveImageUrl(entry as Pick<EntryRow, 'image_url' | 'file_name'>),
            }))
            .filter((item) => item.src);
          setArtworks(resolved);
        }
      } catch (err) {
        console.error('Failed to fetch gallery artworks:', err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [limit]);

  return artworks;
}

function FloatingArtworkMobile({
  src, x, y, size, delay
}: {
  src: string;
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  return (
    <div
      className="absolute opacity-0 animate-float-in"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        animationDelay: `${delay * 0.3}s`,
        animationFillMode: 'forwards',
      }}
    >
      <div
        className="relative w-full h-full rounded-lg overflow-hidden shadow-xl ring-1 ring-white/20"
        style={{
          animation: `float ${7 + delay}s ease-in-out infinite`,
          animationDelay: `${delay * 0.5}s`,
        }}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          priority={delay < 0.5}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
    </div>
  );
}

// Fade in on scroll hook
function useFadeInOnScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll<HTMLElement>('.fade-in-up');

    if (prefersReducedMotion) {
      targets.forEach((t) => t.classList.add('show'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
}

// Hero Background
function HeroBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,_rgba(0,161,233,0.18),_transparent_50%),radial-gradient(ellipse_70%_40%_at_50%_110%,_rgba(0,161,233,0.1),_transparent_45%)]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,161,233,0.8) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
    </div>
  );
}

// Stats Pill
function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10 text-sm">
      <Icon className="w-4 h-4 text-[#00a1e9]" />
      <span className="font-bold text-gray-900">{value}</span>
      <span className="text-gray-500 text-xs">{label}</span>
    </div>
  );
}

// Bottom Fixed Bar
function BottomFixedBar() {
  const [visible, setVisible] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setVisible(scrollY > 400);
      setShowBackToTop(scrollY > 800);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white/95 backdrop-blur-md
        border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]
        transition-all duration-500 ease-out
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}
    >
      <div className="flex items-center justify-between px-4 py-3 max-w-[680px] mx-auto">
        <Link
          href="/white"
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 font-medium text-sm active:scale-95 transition-transform"
        >
          <Eye className="w-4 h-4" />
          ギャラリー
        </Link>

        <div className="flex items-center gap-2">
          {showBackToTop && (
            <button
              onClick={scrollToTop}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-600 active:scale-95 transition-transform"
              aria-label="トップへ戻る"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}

          <Link
            href="/entry"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#00a1e9] to-[#0080c0] text-white font-semibold text-sm shadow-lg active:scale-95 transition-transform"
          >
            <Palette className="w-4 h-4" />
            応募する
          </Link>
        </div>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}

// Announcements Strip Mobile
function AnnouncementsStripMobile() {
  const { items, loading } = useAnnouncements(3);

  const fmt = useMemo(
    () => new Intl.DateTimeFormat('ja-JP', { month: '2-digit', day: '2-digit' }),
    []
  );

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="space-y-2">
      {(items as any[]).slice(0, 2).map((n: any) => (
        <Link
          key={n.id}
          href="/news"
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10 active:bg-[#f0f9ff] transition-colors"
        >
          <AnnouncementBadge type={n.category as 'info' | 'update' | 'maintenance'} />
          <time className="text-[11px] text-gray-400 tabular-nums shrink-0">
            {fmt.format(new Date(n.published_at))}
          </time>
          <span className="text-sm font-medium text-gray-900 truncate flex-1">
            {n.title}
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
        </Link>
      ))}
    </div>
  );
}

function AnnouncementBadge({ type }: { type: 'info' | 'update' | 'maintenance' }) {
  const styles: Record<string, string> = {
    info: 'bg-blue-50 text-blue-600',
    update: 'bg-emerald-50 text-emerald-600',
    maintenance: 'bg-rose-50 text-rose-600',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${styles[type]}`}>
      {type === 'info' ? 'Info' : type === 'update' ? 'Update' : 'Maint'}
    </span>
  );
}

// Gallery Card Mobile
function GalleryCard({
  img, title, desc, badge, badgeColor, link, link2d
}: {
  img: string;
  title: string;
  desc: string;
  badge: string;
  badgeColor: string;
  link: string;
  link2d: string;
}) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm overflow-hidden">
      <Link href={link} className="block relative">
        <div className="relative aspect-[16/10] overflow-hidden">
          <Image
            src={img}
            alt={title}
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute top-3 left-3">
            <Badge className={badgeColor}>{badge}</Badge>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-white/80 text-sm mt-0.5 line-clamp-1">{desc}</p>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 p-3 bg-gray-50">
        <Link
          href={link}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-[#00a1e9] text-white text-sm font-semibold active:scale-[0.98] transition-transform"
        >
          3Dで見る <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href={link2d}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-white ring-1 ring-gray-200 text-gray-700 text-sm font-medium active:scale-[0.98] transition-transform"
        >
          2Dで見る <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// Feature Card Mobile
function FeatureCard({
  icon: Icon, title, desc, color
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  color: 'blue' | 'amber' | 'emerald';
}) {
  const colors = {
    blue: { bg: 'bg-[#00a1e9]/10', text: 'text-[#00a1e9]' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white ring-1 ring-gray-100">
      <div className={`p-2.5 rounded-xl ${colors[color].bg} shrink-0`}>
        <Icon className={`w-5 h-5 ${colors[color].text}`} />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// Main Component
const MobileHome = () => {
  useFadeInOnScroll();
  const galleryArtworks = useGalleryArtworks(4);
  const galleryStats = useGalleryStats();

  // 展示作品と配置パターンを組み合わせる
  const floatingArts = useMemo(() => {
    if (galleryArtworks.length === 0) return [];
    return FLOATING_POSITIONS_MOBILE.slice(0, galleryArtworks.length).map((pos, idx) => ({
      ...pos,
      src: galleryArtworks[idx]?.src || '',
      id: galleryArtworks[idx]?.id || idx,
    }));
  }, [galleryArtworks]);

  return (
    <div className="font-zen text-gray-800 bg-white pb-24">
      <HeroBackground />
      <BottomFixedBar />

      <main className="pt-[64px] relative z-10">
        {/* Hero Section */}
<section
  className="relative min-h-[calc(92svh-64px)] flex flex-col items-center overflow-hidden px-5 pt-10 pb-20"
  aria-labelledby="hero-title"
>
          {/* Floating artworks（展示中の作品）またはシャボン玉 */}
          <div className="absolute inset-0 pointer-events-none">
            {floatingArts.length > 0 ? (
              floatingArts.map((art) => (
                <FloatingArtworkMobile
                  key={art.id}
                  src={art.src}
                  x={art.x}
                  y={art.y}
                  size={art.size}
                  delay={art.delay}
                />
              ))
            ) : (
              <FloatingBubbles variant="mobile" />
            )}
          </div>

          {/* Main content */}
          <div className="relative z-10 text-center translate-y-10">
            <div className="fade-in-up">
              <h1
                id="hero-title"
                className="font-lilita font-bold text-[clamp(3rem,15vw,4.5rem)] leading-none tracking-tight"
              >
                <span className="bg-gradient-to-r from-[#00a1e9] via-[#0080c0] to-[#00a1e9] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                  me-ish
                </span>
              </h1>

              <p className="mt-1 text-[#00a1e9]/70 uppercase tracking-[0.25em] text-xs font-medium">
                online gallery
              </p>
            </div>

            <p className="fade-in-up mt-6 text-[clamp(1.1rem,5vw,1.4rem)] font-medium text-gray-700" style={{ animationDelay: '0.15s' }}>
              アートを、もっと近くに
            </p>

            {/* CTA Buttons */}
            <div className="fade-in-up mt-8 flex flex-col gap-3" style={{ animationDelay: '0.3s' }}>
              <Button
                asChild
                size="lg"
                className="w-full rounded-full py-6 h-auto text-base font-semibold shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-r from-[#00a1e9] to-[#0080c0]"
              >
                <Link href="/float">
                  ギャラリーを見る <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full rounded-full py-5 h-auto text-base font-semibold border-2 border-[#00a1e9] text-[#00a1e9] active:bg-[#e8f7ff] transition-colors"
              >
                <Link href="/entry">
                  応募する <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="fade-in-up mt-8 flex flex-wrap justify-center gap-2" style={{ animationDelay: '0.45s' }}>
              <StatPill
                icon={Palette}
                value={galleryStats ? `${galleryStats.worksCount}` : '–'}
                label="展示作品"
              />
              <StatPill
                icon={Users}
                value={galleryStats ? `${galleryStats.artistsCount}` : '–'}
                label="アーティスト"
              />
            </div>
          </div>

          {/* Scroll hint - w-full で確実に中央揃え */}
          <div className="mt-auto pt-6 w-full fade-in-up" style={{ animationDelay: '0.8s' }}>
            <div className="flex flex-col items-center justify-center gap-1.5 text-[#00a1e9]/40 w-full">
              <span className="text-[10px] tracking-widest uppercase">Scroll</span>
              <div className="w-4 h-6 rounded-full border-2 border-current flex items-start justify-center pt-1">
                <div className="w-0.5 h-1.5 rounded-full bg-current animate-bounce" />
              </div>
            </div>
          </div>
        </section>

        {/* News */}
        <section className={`fade-in-up ${LAYOUT.sectionX} ${LAYOUT.sectionYCompact} bg-gradient-to-b from-[#f8fbff] to-white`}>
          <div className={LAYOUT.container}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">お知らせ</h2>
              <Link href="/news" className="text-xs text-[#00a1e9] font-medium">
                すべて見る →
              </Link>
            </div>
            <AnnouncementsStripMobile />
          </div>
        </section>

        {/* Gallery */}
        <section
          id="gallery"
          className={`fade-in-up ${LAYOUT.sectionX} ${LAYOUT.sectionY}`}
          aria-labelledby="gallery-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader
              title="ギャラリー"
              id="gallery-title"
              subtitle="3D空間で作品を鑑賞"
            />

            <div className="space-y-4">
              <GalleryCard
                img="/images/white-thumb.png"
                title="White Gallery"
                desc="「意識の空間」をイメージした真っ白なギャラリー"
                badge="10作品限定"
                badgeColor="bg-white/90 text-[#00a1e9]"
                link="/white"
                link2d="/white/2d"
              />

              <GalleryCard
                img="/images/float-thumb.png"
                title="Float Gallery"
                desc="漂うように入れ替わる美術館風ギャラリー"
                badge="日替わり"
                badgeColor="bg-amber-500 text-white"
                link="/float"
                link2d="/float/2d"
              />
            </div>
          </div>
        </section>

        {/* About / Features */}
        <section
          id="about"
          className={`fade-in-up ${LAYOUT.sectionX} ${LAYOUT.sectionY} bg-gray-50`}
          aria-labelledby="about-title"
        >
          <div className={LAYOUT.container}>
            <h2
              id="about-title"
              className="text-center text-[clamp(1.5rem,7vw,2rem)] font-bold leading-tight mb-4"
            >
              <span className="text-[#00a1e9] font-lilita">me-ish</span>
              <span className="text-gray-900">とは</span>
            </h2>

            <p className="text-center text-[15px] leading-relaxed text-gray-600 mb-8">
              誰もが自分らしく作品を展示できる、オンラインギャラリー。
              作品の見せ方と出会い方をデザインします。
            </p>

            <div className="space-y-3">
              <FeatureCard
                icon={Sparkles}
                title="3D空間体験"
                desc="Three.jsによる没入感のある鑑賞体験"
                color="blue"
              />
              <FeatureCard
                icon={Images}
                title="簡単応募"
                desc="ガイド付きフローで迷わず出展"
                color="amber"
              />
              <FeatureCard
                icon={ShieldCheck}
                title="画像保護"
                desc="ウォーターマーク・AI認識阻害処理"
                color="emerald"
              />
            </div>
          </div>
        </section>

        {/* Apply CTA */}
        <section
          id="apply"
          className={`fade-in-up ${LAYOUT.sectionX} ${LAYOUT.sectionY}`}
          aria-labelledby="apply-title"
        >
          <div className={LAYOUT.container}>
            <Link
              href="/entry"
              className="group block relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00a1e9] via-[#0090d4] to-[#0080c0] p-8 text-center shadow-xl active:scale-[0.99] transition-transform"
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }} />
              </div>

              {/* Light effect */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/20 rounded-full blur-3xl" />

              <div className="relative z-10">
                <h2 id="apply-title" className="text-xl font-bold text-white leading-tight mb-2">
                  あなたのアートを<br />世界に届けよう
                </h2>
                <p className="text-white/80 text-sm mb-5">
                  me-ishなら、スマホだけでもすぐに展示
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-white text-[#00a1e9] font-bold px-6 py-3 shadow-md">
                  応募する <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Special Thanks */}
        <section className={`fade-in-up ${LAYOUT.sectionX} ${LAYOUT.sectionYCompact}`}>
          <div className={LAYOUT.container}>
            <Link
              href="/special-thanks"
              className="flex items-center justify-center gap-2 p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100 active:bg-amber-50 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                Special Thanks
              </span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className={`fade-in-up ${LAYOUT.sectionX} ${LAYOUT.sectionY} bg-gray-50`}
          aria-labelledby="faq-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader title="よくある質問" id="faq-title" />

            <Accordion type="single" collapsible className="space-y-2">
              {[
                {
                  value: 'q1',
                  q: '誰でも出展できますか？',
                  a: 'はい、プロ・アマ問わずご応募いただけます。展示は審査制です。',
                },
                {
                  value: 'q2',
                  q: '出展に料金はかかりますか？',
                  a: '応募・展示は無料です。作品が売れた場合のみ、売上から手数料をいただきます。',
                },
                {
                  value: 'q3',
                  q: '生成AIは使ってもいいですか？',
                  a: 'AIだけで作った完全生成作品は不可です。補助的な利用はケースにより異なります。',
                },
              ].map(({ value, q, a }) => (
                <AccordionItem
                  key={value}
                  value={value}
                  className="rounded-xl bg-white ring-1 ring-gray-100 overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-4 text-left text-sm font-semibold text-gray-900 hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00a1e9]/10 flex items-center justify-center text-[#00a1e9] font-bold text-xs">
                        Q
                      </span>
                      {q}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
                    <div className="pl-8">{a}</div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-6 text-center">
              <Button
                asChild
                variant="outline"
                className="rounded-full border-[#00a1e9] text-[#00a1e9]"
              >
                <Link href="/footer/faq">
                  もっと見る <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className={`fade-in-up ${LAYOUT.sectionX} ${LAYOUT.sectionY}`}
          aria-labelledby="contact-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader
              title="お問い合わせ"
              id="contact-title"
              subtitle="ご質問などございましたらお気軽に"
            />

            <div className="flex flex-col gap-3">
              <Button
                asChild
                className="w-full rounded-full py-5 h-auto shadow-md"
              >
                <Link href="/contact">
                  <Mail className="h-4 w-4 mr-2" />
                  お問い合わせフォーム
                </Link>
              </Button>

              <a
                href="https://x.com/meishart0716"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-4 rounded-full bg-gray-100 text-gray-700 font-medium active:bg-gray-200 transition-colors"
              >
                <FaXTwitter className="h-4 w-4" />
                X（旧Twitter）
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }

        @keyframes float-in {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.85);
          }
          to {
            opacity: 0.85;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-float-in {
          animation: float-in 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-gradient {
          animation: gradient 4s ease infinite;
        }

        .fade-in-up {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .fade-in-up.show {
          opacity: 1;
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-in-up,
          .animate-float-in {
            opacity: 1;
            transform: none;
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

export default MobileHome;
