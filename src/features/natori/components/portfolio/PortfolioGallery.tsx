"use client";

// features/natori/components/portfolio/PortfolioGallery.tsx
// 作品ギャラリー。マスキングテープで貼ったポラロイド風のカードを並べる。
import { useState } from "react";
import Image from "next/image";
import {
  placeholderPalettes,
  portfolioColors as c,
  tapeColors,
  workRotations,
} from "@/features/natori/constants/portfolioContent";
import { galleryFiltersFromWorks } from "@/features/natori/lib/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import ChibiFace from "./ChibiFace";

function MaskingTape({ color, angle }: { color: string; angle: number }) {
  return (
    <span
      className="absolute -top-3 left-1/2 z-10 h-6 w-20 rounded-[2px]"
      aria-hidden="true"
      style={{
        // テープの半透明感と光沢。両端をわずかにギザギザに見せる
        background: `linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0) 45%), ${color}`,
        opacity: 0.85,
        transform: `translateX(-50%) rotate(${angle}deg)`,
        boxShadow: "0 1px 2px rgba(45,42,61,0.18)",
        clipPath:
          "polygon(2% 0%, 98% 0%, 100% 18%, 98% 38%, 100% 60%, 98% 80%, 100% 100%, 2% 100%, 0% 78%, 2% 58%, 0% 38%, 2% 20%)",
      }}
    />
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

      <div className="grid gap-x-8 gap-y-10 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((work, index) => {
          const palette = placeholderPalettes[index % placeholderPalettes.length];
          const rotate = workRotations[index % workRotations.length];
          const tape = tapeColors[index % tapeColors.length];
          const tapeAngle = index % 2 === 0 ? -4 : 3;
          return (
            <div
              key={work.id}
              className={`pf-pin-card ${rotate} relative rounded-xl p-3 pb-4 pt-5`}
              style={{
                background: c.card,
                boxShadow: "0 10px 20px rgba(45,42,61,0.10)",
              }}
            >
              <MaskingTape color={tape} angle={tapeAngle} />
              {/* 作品画像。編集画面から画像を設定すると差し替わる */}
              <div
                className="relative mb-3 flex items-center justify-center overflow-hidden rounded-lg"
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
        <p className="py-8 text-center text-sm font-bold" style={{ color: c.inkSoft }}>
          このタグの作品はまだありません。
        </p>
      ) : null}
    </section>
  );
}
