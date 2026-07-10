"use client";

// features/natori/components/portfolio/PortfolioGallery.tsx
// 作品ギャラリー。木枠のコルクボードに、ピンで留めた写真風のカードを並べる。
import { useState } from "react";
import Image from "next/image";
import {
  pinColors,
  placeholderPalettes,
  portfolioColors as c,
  workRotations,
} from "@/features/natori/constants/portfolioContent";
import { galleryFiltersFromWorks } from "@/features/natori/lib/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import ChibiFace from "./ChibiFace";

function PushPin({ color }: { color: string }) {
  return (
    <span
      className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2"
      aria-hidden="true"
    >
      {/* ピンの影（ボードに落ちる影） */}
      <span
        className="absolute left-1/2 top-2 h-2 w-2 -translate-x-1/2 rounded-full"
        style={{ background: "rgba(60,35,10,0.35)", filter: "blur(2px)" }}
      />
      {/* ピンの頭 */}
      <span
        className="relative block h-5 w-5 rounded-full"
        style={{
          background: `radial-gradient(circle at 32% 30%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 42%), ${color}`,
          boxShadow:
            "0 2px 3px rgba(60,35,10,0.45), inset -2px -3px 4px rgba(0,0,0,0.28)",
        }}
      />
    </span>
  );
}

export default function PortfolioGallery({ content }: { content: PortfolioContent }) {
  const filters = galleryFiltersFromWorks(content.works);
  const [activeFilter, setActiveFilter] = useState<string>("すべて");

  const shown =
    activeFilter === "すべて"
      ? content.works
      : content.works.filter((work) => work.tag === activeFilter);

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-black md:text-3xl">
          作品ギャラリー <span style={{ color: c.mintDeep }}>°˖✧</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="pf-cute-focus rounded-full border-2 px-4 py-2 text-xs font-bold transition md:text-sm"
              style={
                activeFilter === f
                  ? { background: c.pink, borderColor: c.pink, color: "#fff" }
                  : { background: "transparent", borderColor: c.paperAlt, color: c.inkSoft }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 木枠のコルクボード */}
      <div
        className="rounded-2xl p-2 sm:p-3"
        style={{
          background: `linear-gradient(135deg, #A06B3C 0%, ${c.corkFrame} 45%, #6E4826 100%)`,
          boxShadow: "0 14px 30px rgba(45,42,61,0.25)",
        }}
      >
        <div
          className="rounded-xl px-5 py-8 sm:px-8 sm:py-10"
          style={{
            backgroundColor: c.cork,
            backgroundImage: `radial-gradient(rgba(255,244,224,0.35) 1px, transparent 1.4px),
                              radial-gradient(rgba(96,58,20,0.28) 1.3px, transparent 1.8px),
                              radial-gradient(rgba(96,58,20,0.16) 2px, transparent 2.6px)`,
            backgroundSize: "13px 13px, 21px 21px, 34px 34px",
            backgroundPosition: "0 0, 7px 9px, 15px 4px",
            boxShadow: `inset 0 0 0 1px ${c.corkDark}, inset 0 6px 18px rgba(60,35,10,0.35)`,
          }}
        >
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((work, index) => {
              const palette = placeholderPalettes[index % placeholderPalettes.length];
              const rotate = workRotations[index % workRotations.length];
              const pin = pinColors[index % pinColors.length];
              return (
                <div
                  key={work.id}
                  className={`pf-pin-card ${rotate} relative rounded-lg p-3 pb-4 pt-5`}
                  style={{
                    background: c.card,
                    boxShadow: "0 8px 16px rgba(60,35,10,0.35)",
                  }}
                >
                  <PushPin color={pin} />
                  {/* 作品画像。編集画面から画像を設定すると差し替わる */}
                  <div
                    className="relative mb-3 flex items-center justify-center overflow-hidden rounded"
                    style={{ background: c.paperAlt, height: 180 }}
                  >
                    {work.image ? (
                      <Image
                        src={work.image}
                        alt={work.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <ChibiFace
                        size={110}
                        skin={palette.skin}
                        hair={palette.hair}
                        accent={palette.accent}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-bold">{work.title}</p>
                    {work.tag ? (
                      <span
                        className="shrink-0 rounded-full px-2 py-1 text-xs font-bold"
                        style={{ background: palette.accent, color: c.ink }}
                      >
                        {work.tag}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold" style={{ color: "#5C3A1A" }}>
              このタグの作品はまだありません。
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
