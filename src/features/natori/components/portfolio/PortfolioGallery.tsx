"use client";

// features/natori/components/portfolio/PortfolioGallery.tsx
import { useState } from "react";
import Image from "next/image";
import {
  portfolioArtworks,
  portfolioColors as c,
  portfolioGalleryFilters,
} from "@/features/natori/constants/portfolioContent";
import ChibiFace from "./ChibiFace";

export default function PortfolioGallery() {
  const [activeFilter, setActiveFilter] = useState<string>(portfolioGalleryFilters[0]);

  const shown =
    activeFilter === "すべて"
      ? portfolioArtworks
      : portfolioArtworks.filter((a) => a.tag === activeFilter);

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-black md:text-3xl">
          作品ギャラリー <span style={{ color: c.mintDeep }}>°˖✧</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {portfolioGalleryFilters.map((f) => (
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

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((art) => (
          <div
            key={art.id}
            className={`pf-pin-card ${art.rotate} relative rounded-xl p-4 pt-6`}
            style={{ background: c.card, boxShadow: "0 10px 20px rgba(45,42,61,0.10)" }}
          >
            <span
              className="absolute -top-3 left-8 h-5 w-16 rounded-sm opacity-90"
              style={{ background: c.tape, transform: "rotate(-4deg)" }}
              aria-hidden="true"
            />
            {/* 作品画像。portfolioContent.ts の image にパスを設定すると実画像に差し替わる */}
            <div
              className="relative mb-4 flex items-center justify-center overflow-hidden rounded-lg"
              style={{ background: c.paperAlt, height: 180 }}
            >
              {art.image ? (
                <Image
                  src={art.image}
                  alt={art.title}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <ChibiFace size={110} skin={art.skin} hair={art.hair} accent={art.accent} />
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="font-bold">{art.title}</p>
              <span
                className="rounded-full px-2 py-1 text-xs font-bold"
                style={{ background: art.accent, color: c.ink }}
              >
                {art.tag}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs" style={{ color: c.inkSoft }}>
        ※ 現在はサンプルのプレースホルダーです。実際の作品画像に差し替えてご利用ください。
      </p>
    </section>
  );
}
