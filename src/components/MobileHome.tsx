'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ShieldCheck,
  Images,
  Sparkles,
  Palette,
  Eye,
  Users,
  ChevronUp,
  Bell,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useGalleryArtworks, useGalleryStats } from '@/hooks/useHomePageData';
import { AnnouncementBadge } from '@/components/home/AnnouncementBadge';
import { FAQSection } from '@/components/home/FAQSection';
import { ContactSection } from '@/components/home/ContactSection';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      {/* Blob 1: sky blue, top-left */}
      <div
        className="absolute rounded-full aurora-blob-1"
        style={{
          width: '90vw',
          height: '90vw',
          top: '-30%',
          left: '-20%',
          background: 'radial-gradient(circle, rgba(0,161,233,0.28) 0%, transparent 65%)',
        }}
      />
      {/* Blob 2: cyan, top-right */}
      <div
        className="absolute rounded-full aurora-blob-2"
        style={{
          width: '70vw',
          height: '70vw',
          top: '-20%',
          right: '-20%',
          background: 'radial-gradient(circle, rgba(34,211,238,0.2) 0%, transparent 65%)',
        }}
      />
      {/* Blob 3: indigo, bottom-center */}
      <div
        className="absolute rounded-full aurora-blob-3"
        style={{
          width: '65vw',
          height: '65vw',
          bottom: '-15%',
          left: '15%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.16) 0%, transparent 65%)',
        }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,161,233,0.9) 1px, transparent 1px)',
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
  const t = useTranslations('home.bottomBar');
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
          {t('gallery')}
        </Link>

        <div className="flex items-center gap-2">
          {showBackToTop && (
            <button
              onClick={scrollToTop}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-600 active:scale-95 transition-transform"
              aria-label={t('backToTop')}
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}

          <Link
            href="/entry"
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#00a1e9] to-[#0080c0] text-white font-semibold text-sm shadow-lg active:scale-95 transition-transform"
          >
            <Palette className="w-4 h-4" />
            {t('apply')}
          </Link>
        </div>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}

// Announcements Strip Mobile
function AnnouncementsStripMobile() {
  const t = useTranslations('home.news');
  const locale = useLocale();
  const { items, loading } = useAnnouncements(3);

  const fmt = useMemo(
    () => new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', { month: '2-digit', day: '2-digit' }),
    [locale]
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
          <AnnouncementBadge type={n.category as 'info' | 'update' | 'maintenance'} className="shrink-0" />
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

// Gallery Card Mobile
function GalleryCard({
  img, title, desc, badge, badgeColor, link, link2d,
  view3dLabel, view2dLabel,
}: {
  img: string;
  title: string;
  desc: string;
  badge: string;
  badgeColor: string;
  link: string;
  link2d: string;
  view3dLabel: string;
  view2dLabel: string;
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
          {view3dLabel} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href={link2d}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-white ring-1 ring-gray-200 text-gray-700 text-sm font-medium active:scale-[0.98] transition-transform"
        >
          {view2dLabel} <ArrowRight className="w-3.5 h-3.5" />
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
  const t = useTranslations('home');

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
          {/* Floating artworks またはシャボン玉 */}
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
              {t('hero.tagline')}
            </p>

            {/* CTA Buttons */}
            <div className="fade-in-up mt-8 flex flex-col gap-3" style={{ animationDelay: '0.3s' }}>
              <Button
                asChild
                size="lg"
                className="w-full rounded-full py-6 h-auto text-base font-semibold shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-r from-[#00a1e9] to-[#0080c0]"
              >
                <Link href="/float">
                  {t('hero.viewGallery')} <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full rounded-full py-5 h-auto text-base font-semibold border-2 border-[#00a1e9] text-[#00a1e9] active:bg-[#e8f7ff] transition-colors"
              >
                <Link href="/entry">
                  {t('hero.apply')} <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="fade-in-up mt-8 flex flex-wrap justify-center gap-2" style={{ animationDelay: '0.45s' }}>
              <StatPill
                icon={Palette}
                value={galleryStats ? `${galleryStats.worksCount}` : '–'}
                label={t('stats.works')}
              />
              <StatPill
                icon={Users}
                value={galleryStats ? `${galleryStats.artistsCount}` : '–'}
                label={t('stats.artists')}
              />
            </div>
          </div>

          {/* Scroll hint */}
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
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                <Bell className="h-3.5 w-3.5 text-[#00a1e9]" />
                {t('news.title')}
              </h2>
              <Link href="/news" className="text-xs text-[#00a1e9] font-medium">
                {t('news.viewAllShort')} →
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
              title={t('gallery.titleMobile')}
              id="gallery-title"
              subtitle={t('gallery.subtitleMobile')}
            />

            <div className="space-y-4">
              <GalleryCard
                img="/images/white-thumb.png"
                title="White Gallery"
                desc={t('gallery.whiteDesc')}
                badge={t('gallery.whiteBadge')}
                badgeColor="bg-white/90 text-[#00a1e9]"
                link="/white"
                link2d="/white/2d"
                view3dLabel={t('gallery.view3d')}
                view2dLabel={t('gallery.view2d')}
              />

              <GalleryCard
                img="/images/float-thumb.png"
                title="Float Gallery"
                desc={t('gallery.floatDesc')}
                badge={t('gallery.floatBadge')}
                badgeColor="bg-amber-500 text-white"
                link="/float"
                link2d="/float/2d"
                view3dLabel={t('gallery.view3d')}
                view2dLabel={t('gallery.view2d')}
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
              <span className="text-gray-900">{t('about.titlePrefix')}</span>
              <span className="text-[#00a1e9] font-lilita">me-ish</span>
              <span className="text-gray-900">{t('about.titleSuffix')}</span>
            </h2>

            <p className="text-center text-[15px] leading-relaxed text-gray-600 mb-8">
              {t('about.bodySimple')}
            </p>

            <div className="space-y-3">
              <FeatureCard
                icon={Sparkles}
                title={t('features.3dTitle')}
                desc={t('features.3dDesc')}
                color="blue"
              />
              <FeatureCard
                icon={Images}
                title={t('features.entryTitle')}
                desc={t('features.entryDesc')}
                color="amber"
              />
              <FeatureCard
                icon={ShieldCheck}
                title={t('features.protectionTitle')}
                desc={t('features.protectionDesc')}
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
                  {t('apply.title')}
                </h2>
                <p className="text-white/80 text-sm mb-5">
                  {t('apply.subtitleMobile')}
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-white text-[#00a1e9] font-bold px-6 py-3 shadow-md">
                  {t('apply.button')} <ArrowRight className="h-4 w-4" />
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
            <p className="mt-2 text-center text-xs text-gray-400">
              {t('thanks.desc')}
            </p>
          </div>
        </section>

        {/* FAQ & Contact */}
        <FAQSection variant="mobile" />
        <ContactSection variant="mobile" />
      </main>

      {/* Animations */}
      <style jsx global>{`
        @keyframes aurora-blob-1 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          25%  { transform: translate(4%, -3%) scale(1.06); }
          50%  { transform: translate(-3%, 5%) scale(0.96); }
          75%  { transform: translate(3%, 2%) scale(1.02); }
        }
        @keyframes aurora-blob-2 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33%  { transform: translate(-5%, 4%) scale(1.04); }
          66%  { transform: translate(3%, -4%) scale(0.97); }
        }
        @keyframes aurora-blob-3 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          40%  { transform: translate(3%, -5%) scale(1.05); }
          80%  { transform: translate(-3%, 3%) scale(0.98); }
        }
        .aurora-blob-1 {
          animation: aurora-blob-1 16s ease-in-out infinite;
          will-change: transform;
        }
        .aurora-blob-2 {
          animation: aurora-blob-2 21s ease-in-out infinite;
          will-change: transform;
        }
        .aurora-blob-3 {
          animation: aurora-blob-3 26s ease-in-out infinite;
          will-change: transform;
        }

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
          .animate-float-in,
          .aurora-blob-1,
          .aurora-blob-2,
          .aurora-blob-3 {
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
