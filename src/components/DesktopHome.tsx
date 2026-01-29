'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  Sparkles,
  ShieldCheck,
  Images,
  ArrowRight,
  ExternalLink,
  Palette,
  Eye,
  Users,
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { supabase } from '@/lib/supabaseClient';
import { resolveImageUrl, type EntryRow } from '@/lib/gallery/galleryUtils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { BackToTop } from '@/components/shared/BackToTop';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/*
   Layout Tokens
────────────────────────────────────────────────────────────── */
const LAYOUT = {
  container: 'mx-auto w-full max-w-[1200px] px-6',
  sectionY: 'py-20 md:py-28',
  sectionYCompact: 'py-12 md:py-16',
} as const;

/*
   Card Styles
────────────────────────────────────────────────────────────── */
const CARD = {
  base: 'rounded-2xl bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10 border border-white/60 shadow-sm',
  hover: 'hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
  glass: 'rounded-2xl bg-white/60 backdrop-blur-md ring-1 ring-white/40 border border-white/30 shadow-lg',
  solid: 'rounded-2xl bg-white ring-1 ring-[#00a1e9]/8 border border-gray-100/80 shadow-sm',
} as const;

// 浮遊アート用の配置パターン
const FLOATING_POSITIONS = [
  { x: 6, y: 12, size: 130, delay: 0 },
  { x: 88, y: 8, size: 110, delay: 0.4 },
  { x: 4, y: 48, size: 100, delay: 0.8 },
  { x: 92, y: 52, size: 105, delay: 1.2 },
  { x: 8, y: 78, size: 85, delay: 1.6 },
  { x: 85, y: 82, size: 90, delay: 2.0 },
  { x: 78, y: 25, size: 75, delay: 2.4 },
  { x: 18, y: 32, size: 70, delay: 2.8 },
];

// 展示作品を取得するフック
function useGalleryArtworks(limit = 8) {
  const [artworks, setArtworks] = useState<{ src: string; id: number }[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // White と Float の展示作品を取得
        const { data, error } = await supabase
          .from('entries')
          .select('id, image_url, file_name')
          .eq('confirmed', true)
          .eq('display_ready', true)
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

// ギャラリー統計を取得するフック
function useGalleryStats() {
  const [stats, setStats] = useState<{ worksCount: number; artistsCount: number } | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 展示中の作品を取得（user_idも含める）
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

function FloatingArtwork({
  src, x, y, size, delay, mouseX, mouseY
}: {
  src: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  mouseX: number;
  mouseY: number;
}) {
  const parallaxX = (mouseX - 0.5) * 20;
  const parallaxY = (mouseY - 0.5) * 20;

  return (
    <div
      className="absolute opacity-0 animate-float-in"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        transform: `translate(${parallaxX * (1 + delay * 0.1)}px, ${parallaxY * (1 + delay * 0.1)}px)`,
        animationDelay: `${delay * 0.3}s`,
        animationFillMode: 'forwards',
      }}
    >
      <div
        className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20"
        style={{
          animation: `float ${6 + delay}s ease-in-out infinite`,
          animationDelay: `${delay * 0.5}s`,
        }}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          priority={delay < 1}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
    </div>
  );
}

/*
   スクロール時のフェードイン（stagger対応）
────────────────────────────────────────────────────────────── */
function useStaggerFadeIn() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll<HTMLElement>('.fade-in-up');

    if (prefersReducedMotion) {
      targets.forEach((t) => t.classList.add('show'));
      return;
    }

    const callback: IntersectionObserverCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // stagger-childrenの場合、子要素にも順番にクラス追加
          const children = entry.target.querySelectorAll<HTMLElement>('.stagger-item');
          if (children.length > 0) {
            children.forEach((child, idx) => {
              setTimeout(() => child.classList.add('show'), idx * 100);
            });
          }
          entry.target.classList.add('show');
          observer.unobserve(entry.target);
        }
      });
    };
    const observer = new IntersectionObserver(callback, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
}

/*
   マウス位置トラッキング
────────────────────────────────────────────────────────────── */
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return position;
}

/*
   プログレスインジケーター
────────────────────────────────────────────────────────────── */
const SECTIONS = [
  { id: 'hero', label: 'Top' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'about', label: 'About' },
  { id: 'apply', label: 'Apply' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
];

function ProgressIndicator() {
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3;

      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed right-8 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-3">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollToSection(section.id)}
          className="group flex items-center gap-3"
          aria-label={`${section.label}へスクロール`}
        >
          <span className={`
            text-xs font-medium transition-all duration-300 opacity-0 -translate-x-2
            group-hover:opacity-100 group-hover:translate-x-0
            ${activeSection === section.id ? 'text-[#00a1e9]' : 'text-gray-400'}
          `}>
            {section.label}
          </span>
          <span className={`
            w-2.5 h-2.5 rounded-full transition-all duration-300
            ${activeSection === section.id
              ? 'bg-[#00a1e9] scale-125'
              : 'bg-gray-300 group-hover:bg-[#00a1e9]/50'}
          `} />
        </button>
      ))}
    </nav>
  );
}

/*
   Floating CTA Button
────────────────────────────────────────────────────────────── */
function FloatingCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 600);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Link
      href="/entry"
      className={`
        fixed bottom-6 left-6 z-50
        flex items-center gap-2 px-5 py-3 rounded-full
        bg-gradient-to-r from-[#00a1e9] to-[#0080c0]
        text-white font-semibold text-sm shadow-xl
        transition-all duration-500 ease-out
        hover:shadow-2xl hover:scale-105 hover:from-[#0090d4] hover:to-[#0070a8]
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}
      `}
      aria-label="作品を応募する"
    >
      <Palette className="w-4 h-4" />
      応募する
    </Link>
  );
}

/*
   Stats Counter
────────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10">
      <div className="p-2 rounded-lg bg-[#00a1e9]/10">
        <Icon className="w-5 h-5 text-[#00a1e9]" />
      </div>
      <div>
        <p className="text-xl font-bold text-[#023]">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

/*
   Bento Grid Card
────────────────────────────────────────────────────────────── */
function BentoCard({
  children,
  className = '',
  href,
  size = 'normal'
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
  size?: 'normal' | 'large' | 'wide';
}) {
  const sizeClasses = {
    normal: '',
    large: 'md:col-span-2 md:row-span-2',
    wide: 'md:col-span-2',
  };

  const content = (
    <div className={`
      group relative overflow-hidden rounded-3xl
      bg-white ring-1 ring-gray-100
      transition-all duration-500
      hover:shadow-2xl hover:-translate-y-1 hover:ring-[#00a1e9]/20
      ${sizeClasses[size]}
      ${className}
    `}>
      {children}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}

/*
   ニュース
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
      <div className="flex gap-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!list.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {list.map((n) => (
        <Link
          key={n.id}
          href="/news"
          className={`
            flex items-center gap-3 px-4 py-2.5 rounded-full
            bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10
            hover:bg-[#f0f9ff] hover:ring-[#00a1e9]/20
            transition-all duration-200 group
          `}
        >
          <AnnouncementBadge type={n.category} />
          <time className="text-xs text-gray-400 tabular-nums">
            {fmt.format(new Date(n.published_at))}
          </time>
          <span className="text-sm font-medium text-[#023] group-hover:text-[#00a1e9] transition-colors truncate max-w-[200px]">
            {n.title}
          </span>
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
  const labels: Record<string, string> = { info: 'Info', update: 'Update', maintenance: 'Maint' };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

/*
   背景レイヤー
────────────────────────────────────────────────────────────── */
function HeroBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* メッシュグラデーション */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-20%,_rgba(0,161,233,0.15),_transparent_50%),radial-gradient(ellipse_60%_40%_at_80%_100%,_rgba(0,161,233,0.1),_transparent_40%)]" />

      {/* 微細ドットパターン */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,161,233,0.8) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* ノイズテクスチャ */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />
    </div>
  );
}

/*
   FAQ Section
────────────────────────────────────────────────────────────── */
function FAQSection() {
  return (
    <section
      id="faq"
      className={`fade-in-up ${LAYOUT.sectionY} px-6 bg-gradient-to-b from-gray-50 to-white`}
      aria-labelledby="faq-title"
    >
      <div className={LAYOUT.container}>
        <SectionHeader title="よくある質問" id="faq-title" underline />

        <div className="max-w-[880px] mx-auto">
          <Accordion type="single" collapsible defaultValue="item-0" className="space-y-4">
            {[
              {
                q: '誰でも出展できますか？',
                a: 'はい、プロ・アマ問わずご応募いただけます。展示は審査制です。',
              },
              {
                q: '出展に料金はかかりますか？',
                a: '応募・展示は無料です。作品が売れた場合のみ、売上から手数料をいただきます。',
              },
              {
                q: '生成AIは使ってもいいですか？',
                a: 'AIだけで作った"完全生成"作品は不可です。補助的な利用はケースにより異なります。詳細はFAQをご確認ください。',
              },
            ].map(({ q, a }, idx) => (
              <AccordionItem
                key={idx}
                value={`item-${idx}`}
                className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-5 text-left font-semibold text-[#023] hover:no-underline hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00a1e9]/10 flex items-center justify-center text-[#00a1e9] font-bold text-sm">
                      Q
                    </span>
                    {q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-5 text-[#445] leading-relaxed">
                  <div className="pl-11">{a}</div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-10 text-center">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full border-[#00a1e9] text-[#00a1e9] hover:bg-[#00a1e9] hover:text-white transition-all duration-300"
          >
            <Link href="/footer/faq">
              すべてのFAQを見る <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/*
   Contact Section
────────────────────────────────────────────────────────────── */
function ContactSection() {
  return (
    <section
      id="contact"
      className={`fade-in-up ${LAYOUT.sectionY} px-6 bg-white`}
      aria-labelledby="contact-title"
    >
      <div className={LAYOUT.container}>
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader
            title="お問い合わせ"
            id="contact-title"
            subtitle="ご質問・ご相談などございましたら、お気軽にご連絡ください。"
            underline
          />

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 py-4 h-auto text-base shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link href="/contact">
                <Mail className="h-5 w-5 mr-2" />
                お問い合わせフォーム
              </Link>
            </Button>

            <a
              href="https://x.com/meishart0716"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-[#00a1e9] hover:text-white transition-all duration-300"
              aria-label="X（旧Twitter）"
            >
              <FaXTwitter className="h-6 w-6" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
   Main Component
────────────────────────────────────────────────────────────── */
const DesktopHome = () => {
  useStaggerFadeIn();
  const mousePosition = useMousePosition();
  const galleryArtworks = useGalleryArtworks(8);
  const galleryStats = useGalleryStats();

  // 展示作品と配置パターンを組み合わせる
  const floatingArts = useMemo(() => {
    if (galleryArtworks.length === 0) return [];
    return FLOATING_POSITIONS.slice(0, galleryArtworks.length).map((pos, idx) => ({
      ...pos,
      src: galleryArtworks[idx]?.src || '',
      id: galleryArtworks[idx]?.id || idx,
    }));
  }, [galleryArtworks]);

  return (
    <div className="font-zen text-[#222] bg-white">
      <HeroBackground />
      <ProgressIndicator />
      <FloatingCTA />

      <main className="pt-[70px] relative z-10">
        {/* Hero Section */}
        <section
          id="hero"
          className="relative min-h-[calc(92svh-70px)] md:min-h-[calc(96svh-70px)] flex flex-col items-center justify-center overflow-hidden pt-10 md:pt-14 pb-10"
          aria-labelledby="hero-title"
        >
          {/* 浮遊するアート作品（展示中の作品） */}
          <div className="absolute inset-0 pointer-events-none">
            {floatingArts.map((art) => (
              <FloatingArtwork
                key={art.id}
                src={art.src}
                x={art.x}
                y={art.y}
                size={art.size}
                delay={art.delay}
                mouseX={mousePosition.x}
                mouseY={mousePosition.y}
              />
            ))}
          </div>

          {/* メインコンテンツ */}
          <div className="relative z-10 text-center px-6 md:translate-y-4">
            <div className="fade-in-up">
              <h1
                id="hero-title"
                className="font-lilita font-bold text-[clamp(4rem,12vw,8rem)] leading-none tracking-tight"
              >
                <span className="bg-gradient-to-r from-[#00a1e9] via-[#0080c0] to-[#00a1e9] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                  me-ish
                </span>
              </h1>

              <p className="mt-2 text-[#00a1e9]/70 uppercase tracking-[0.3em] text-sm md:text-base font-medium">
                online gallery
              </p>
            </div>

            <p className="fade-in-up mt-8 text-[clamp(1.2rem,3vw,2rem)] font-medium text-[#333]" style={{ animationDelay: '0.2s' }}>
              アートを、もっと近くに
            </p>

            {/* CTA Buttons */}
            <div className="fade-in-up mt-10 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: '0.4s' }}>
              <Button
                asChild
                size="lg"
                className="rounded-full px-10 py-6 h-auto text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-gradient-to-r from-[#00a1e9] to-[#0080c0] hover:from-[#0090d4] hover:to-[#0070a8]"
              >
                <Link href="/white">
                  ギャラリーを見る <ArrowRight className="h-5 w-5 ml-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full px-8 py-5 h-auto text-base font-semibold border-2 border-[#00a1e9] text-[#00a1e9] hover:bg-[#00a1e9] hover:text-white transition-all duration-300"
              >
                <Link href="/entry">
                  応募する <ExternalLink className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="fade-in-up mt-16 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: '0.6s' }}>
              <StatCard
                icon={Palette}
                value={galleryStats ? `${galleryStats.worksCount}` : '–'}
                label="展示作品"
              />
              <StatCard
                icon={Users}
                value={galleryStats ? `${galleryStats.artistsCount}` : '–'}
                label="アーティスト"
              />
              <StatCard icon={Eye} value="Coming Soon" label="ユニーク閲覧" />
            </div>
          </div>

          {/* スクロールヒント */}
          <div
  className="mt-auto pt-8 fade-in-up relative z-20 -translate-y-6 md:-translate-y-14"
  style={{ animationDelay: '1s' }}
>

            <div className="flex flex-col items-center gap-2 text-[#00a1e9]/50">
              <span className="text-xs tracking-widest uppercase">Scroll</span>
              <div className="w-5 h-8 rounded-full border-2 border-current flex justify-center pt-2">
                <div className="w-1 h-2 rounded-full bg-current animate-bounce" />
              </div>
            </div>
          </div>
        </section>

        {/* News Strip */}
        <section className="fade-in-up py-6 px-6 bg-gradient-to-b from-[#f8fbff] to-white">
          <div className={LAYOUT.container}>
            <div className="flex items-center justify-between gap-6">
              <AnnouncementsStrip max={3} />
              <Button asChild variant="ghost" size="sm" className="text-[#00a1e9] hover:bg-[#e8f7ff] shrink-0">
                <Link href="/news">
                  一覧を見る <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Bento Grid - Gallery & Features */}
        <section
          id="gallery"
          className={`fade-in-up ${LAYOUT.sectionY} px-6`}
          aria-labelledby="gallery-title"
        >
          <div className={LAYOUT.container}>
            <SectionHeader
              title="ギャラリーを探索"
              id="gallery-title"
              subtitle="3D空間で作品を鑑賞する、新しいアート体験"
              underline
            />

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5">
              {/* White Gallery - Large */}
              <BentoCard href="/white" size="large" className="stagger-item">
                <div className="relative h-full min-h-[320px] md:min-h-[420px]">
                  <Image
                    src="/images/white-thumb.png"
                    alt="White Gallery"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                  <div className="absolute top-4 left-4">
                    <Badge className="bg-white/90 text-[#00a1e9] backdrop-blur-sm">10作品限定</Badge>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">White Gallery</h3>
                    <p className="text-white/80 text-sm mb-4">「意識の空間」をイメージした真っ白なギャラリー</p>
                    <div className="flex gap-2">
                      <span className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
                        3Dで見る →
                      </span>
                    </div>
                  </div>
                </div>
              </BentoCard>

              {/* Float Gallery */}
              <BentoCard href="/float" className="stagger-item md:col-span-2">
                <div className="relative h-full min-h-[200px] md:min-h-[200px]">
                  <Image
                    src="/images/float-thumb.jpg"
                    alt="Float Gallery"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

                  <div className="absolute top-4 left-4">
                    <Badge className="bg-amber-500 text-white">日替わり</Badge>
                  </div>

                  <div className="absolute bottom-0 left-0 p-5">
                    <h3 className="text-xl font-bold text-white mb-1">Float Gallery</h3>
                    <p className="text-white/80 text-sm">"漂う"ように入れ替わる美術館風ギャラリー</p>
                  </div>
                </div>
              </BentoCard>

              {/* Feature Cards */}
              <BentoCard className="stagger-item p-6 bg-gradient-to-br from-[#e8f7ff] to-white">
                <div className="h-full flex flex-col">
                  <div className="p-3 rounded-xl bg-[#00a1e9]/10 w-fit">
                    <Sparkles className="w-6 h-6 text-[#00a1e9]" />
                  </div>
                  <h3 className="mt-4 font-bold text-[#023]">3D空間体験</h3>
                  <p className="mt-2 text-sm text-gray-600 flex-grow">Three.jsによる没入感のある鑑賞体験</p>
                </div>
              </BentoCard>

              <BentoCard className="stagger-item p-6 bg-gradient-to-br from-[#fff8e8] to-white">
                <div className="h-full flex flex-col">
                  <div className="p-3 rounded-xl bg-amber-500/10 w-fit">
                    <Images className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="mt-4 font-bold text-[#023]">簡単応募</h3>
                  <p className="mt-2 text-sm text-gray-600 flex-grow">ガイド付きフローで迷わず出展</p>
                </div>
              </BentoCard>

              <BentoCard className="stagger-item p-6 bg-gradient-to-br from-[#f0fff4] to-white">
                <div className="h-full flex flex-col">
                  <div className="p-3 rounded-xl bg-emerald-500/10 w-fit">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h3 className="mt-4 font-bold text-[#023]">画像保護</h3>
                  <p className="mt-2 text-sm text-gray-600 flex-grow">ウォーターマーク・AI認識阻害処理</p>
                </div>
              </BentoCard>

              {/* 2D Gallery Links */}
              <BentoCard className="stagger-item md:col-span-2 p-6 bg-gray-50">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <h3 className="font-bold text-[#023]">2Dモードで見る</h3>
                    <p className="text-sm text-gray-500 mt-1">軽量な2Dギャラリーもあります</p>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href="/white/2d"
                      className="px-4 py-2 rounded-full bg-white ring-1 ring-gray-200 text-sm font-medium text-gray-700 hover:ring-[#00a1e9] hover:text-[#00a1e9] transition-all"
                    >
                      White 2D
                    </Link>
                    <Link
                      href="/float/2d"
                      className="px-4 py-2 rounded-full bg-white ring-1 ring-gray-200 text-sm font-medium text-gray-700 hover:ring-[#00a1e9] hover:text-[#00a1e9] transition-all"
                    >
                      Float 2D
                    </Link>
                  </div>
                </div>
              </BentoCard>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section
          id="about"
          className={`fade-in-up ${LAYOUT.sectionY} px-6 bg-gradient-to-b from-white to-gray-50`}
          aria-labelledby="about-title"
        >
          <div className={LAYOUT.container}>
            <div className="max-w-3xl mx-auto text-center">
              <h2 id="about-title" className="fade-in-up text-[clamp(2rem,5vw,3rem)] font-bold leading-tight">
                <span className="text-[#00a1e9] font-lilita">me-ish</span>
                <span className="text-[#023]">とは</span>
              </h2>

              <p className="fade-in-up mt-8 text-lg md:text-xl leading-relaxed text-gray-600" style={{ animationDelay: '0.1s' }}>
                me-ish（ミーイッシュ）は、誰もが自分らしく作品を展示できるオンラインギャラリー。
              </p>
              <p className="fade-in-up mt-4 text-lg md:text-xl leading-relaxed text-gray-600" style={{ animationDelay: '0.2s' }}>
                作品の<span className="text-[#00a1e9] font-semibold">"見せ方"</span>と
                <span className="text-[#00a1e9] font-semibold">"出会い方"</span>をデザインし、
                <br className="hidden md:block" />
                アーティストと鑑賞者の距離を縮めます。
              </p>
            </div>
          </div>
        </section>

        {/* Apply CTA Section */}
        <section
          id="apply"
          className={`fade-in-up ${LAYOUT.sectionY} px-6`}
          aria-labelledby="apply-title"
        >
          <div className={LAYOUT.container}>
            <Link
              href="/entry"
              className="group block relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#00a1e9] via-[#0090d4] to-[#0080c0] p-12 md:p-16 text-center shadow-xl hover:shadow-2xl transition-all duration-500"
            >
              {/* 背景パターン */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                }} />
              </div>

              {/* 光のエフェクト */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl group-hover:bg-white/30 transition-all duration-500" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

              <div className="relative z-10">
                <h2 id="apply-title" className="text-[clamp(1.8rem,4vw,2.8rem)] font-bold text-white leading-tight mb-4">
                  あなたのアートを<br className="md:hidden" />世界に届けよう
                </h2>
                <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
                  me-ishでは、どなたでも気軽に作品を展示できます。<br className="hidden md:block" />
                  あなたの創作を、新しい空間で見せてみませんか？
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-white text-[#00a1e9] font-bold px-8 py-4 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                  応募する <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Special Thanks */}
        <section
          className={`fade-in-up ${LAYOUT.sectionYCompact} px-6 bg-white`}
          aria-labelledby="thanks-title"
        >
          <div className={LAYOUT.container}>
            <div className="max-w-xl mx-auto text-center p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100">
              <Link
                href="/special-thanks"
                className="group inline-flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <Sparkles className="h-5 w-5 text-amber-500 group-hover:animate-pulse" />
                <h2 id="thanks-title" className="text-xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                  Special Thanks
                </h2>
                <Sparkles className="h-5 w-5 text-amber-500 group-hover:animate-pulse" />
              </Link>
              <p className="mt-2 text-sm text-gray-500">
                me-ish初期ギャラリー(white)に応募してくださった皆さま
              </p>
            </div>
          </div>
        </section>

        {/* FAQ & Contact */}
        <FAQSection />
        <ContactSection />
      </main>

      <BackToTop />

      {/* Animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }

        @keyframes float-in {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.8);
          }
          to {
            opacity: 0.9;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-float-in {
          animation: float-in 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-gradient {
          animation: gradient 4s ease infinite;
        }

        .fade-in-up {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .fade-in-up.show {
          opacity: 1;
          transform: translateY(0);
        }

        .stagger-item {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .stagger-item.show {
          opacity: 1;
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-in-up,
          .stagger-item,
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

export default DesktopHome;
