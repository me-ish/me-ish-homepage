// src/components/card/renderer/CardRenderer.tsx
"use client";

import { Twitter, Instagram, Globe, Mail } from "lucide-react";
import type { CardDesign, CardContent } from "@/lib/card/card.schema";
import CardQRCode from "../CardQRCode";
import { useParallax } from "../animations/useParallax";
import { useScrollReveal } from "../animations/useScrollReveal";

type Props = {
  design: CardDesign;
  content: CardContent;
  publicUrl?: string;
};

const SNS_ICONS: Record<string, React.ElementType> = {
  twitter: Twitter,
  instagram: Instagram,
  website: Globe,
};

export default function CardRenderer({ design, content, publicUrl }: Props) {
  const isPremium = design.animation;
  const { ref: parallaxRef, offset } = useParallax(isPremium, 0.25);

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: design.colorBG,
        color: design.colorText,
      }}
    >
      {/* ============ HERO SECTION ============ */}
      <section
        ref={parallaxRef}
        className="relative overflow-hidden py-16 sm:py-24 px-6"
        style={
          design.bgGradient && design.bgGradient !== "none"
            ? { backgroundImage: design.bgGradient }
            : undefined
        }
      >
        {/* Animated gradient overlay for premium */}
        {isPremium && (
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(135deg, ${design.colorPrimary}22, ${design.colorAccent}22, ${design.colorPrimary}22)`,
              backgroundSize: "400% 400%",
              animation: "cardGradientShift 8s ease infinite",
            }}
          />
        )}

        <div
          className="relative max-w-md mx-auto flex flex-col items-center text-center"
          style={
            isPremium
              ? { transform: `translateY(${offset * 0.15}px)` }
              : undefined
          }
        >
          {/* Avatar */}
          {content.profile.avatarUrl && (
            <div
              className="w-28 h-28 rounded-full overflow-hidden border-4 shadow-lg mb-6"
              style={{ borderColor: design.colorPrimary + "33" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={content.profile.avatarUrl}
                alt={content.profile.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Name */}
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ color: design.colorText }}
          >
            {content.profile.name}
          </h1>

          {/* Title / Tagline */}
          <p
            className="mt-2 text-base sm:text-lg opacity-80"
            style={{ color: design.colorText }}
          >
            {content.profile.title}
          </p>
          {content.profile.tagline && (
            <p
              className="mt-1 text-sm opacity-60 italic"
              style={{ color: design.colorText }}
            >
              {content.profile.tagline}
            </p>
          )}

          {/* SNS icons */}
          {content.profile.sns && content.profile.sns.length > 0 && (
            <div className="mt-6 flex items-center gap-4">
              {content.profile.sns.map((link, i) => {
                const Icon = SNS_ICONS[link.type] ?? Globe;
                return (
                  <a
                    key={`${link.type}-${i}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full transition-all hover:scale-110"
                    style={{
                      color: design.colorPrimary,
                      backgroundColor: design.colorPrimary + "15",
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
              <a
                href={`mailto:${content.profile.email}`}
                className="p-2 rounded-full transition-all hover:scale-110"
                style={{
                  color: design.colorPrimary,
                  backgroundColor: design.colorPrimary + "15",
                }}
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ============ WORKS SHOWCASE ============ */}
      {content.works && content.works.length > 0 && (
        <section className="py-12 sm:py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <h2
              className="text-xl font-bold mb-8 text-center"
              style={{ color: design.colorText }}
            >
              Works
            </h2>
            <div
              className={`grid gap-5 ${
                content.works.length === 1
                  ? "grid-cols-1 max-w-sm mx-auto"
                  : content.works.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {content.works.map((work, i) => (
                <WorkCard
                  key={`work-${i}`}
                  work={work}
                  design={design}
                  index={i}
                  isPremium={isPremium}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ QR CODE SECTION ============ */}
      {publicUrl && (
        <section className="py-12 sm:py-16 px-6">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <h2
              className="text-lg font-bold mb-6 text-center"
              style={{ color: design.colorText }}
            >
              Share this card
            </h2>
            <CardQRCode
              url={publicUrl}
              size={140}
              colorPrimary={design.colorPrimary}
              colorBG={design.colorBG}
            />
            <p
              className="mt-4 text-xs opacity-50 text-center"
              style={{ color: design.colorText }}
            >
              タップでフリップ
            </p>
          </div>
        </section>
      )}

      {/* ============ BRANDING FOOTER ============ */}
      {content.branding && (
        <footer className="py-8 text-center">
          <p className="text-xs opacity-40" style={{ color: design.colorText }}>
            made with{" "}
            <a
              href="/"
              className="underline hover:opacity-70"
              style={{ color: design.colorPrimary }}
            >
              me-ish
            </a>
          </p>
        </footer>
      )}

      {/* Global keyframes */}
      <style jsx global>{`
        @keyframes cardGradientShift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------- Work Card Sub-component ---------- */

function WorkCard({
  work,
  design,
  index,
  isPremium,
}: {
  work: { imageUrl: string; title?: string };
  design: CardDesign;
  index: number;
  isPremium: boolean;
}) {
  const { ref, visible } = useScrollReveal(isPremium);

  return (
    <div
      ref={ref}
      className="group rounded-xl overflow-hidden transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${index * 100}ms`,
        boxShadow: `0 4px 20px ${design.colorPrimary}15`,
      }}
    >
      <div className="aspect-[4/3] overflow-hidden bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={work.imageUrl}
          alt={work.title || `Work ${index + 1}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      {work.title && (
        <div
          className="px-4 py-3"
          style={{ backgroundColor: design.colorBG }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: design.colorText }}
          >
            {work.title}
          </p>
        </div>
      )}
    </div>
  );
}
