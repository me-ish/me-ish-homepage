"use client";

// features/natori/components/portfolio/PortfolioGallery.tsx
// 作品ギャラリー。マスキングテープで貼ったポラロイド風のカードを並べる。
// 画像はX(Twitter)の縦長表示に近い 3:4 で見せ、クリックでモーダル拡大表示。
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  placeholderPalettes,
  portfolioColors as c,
  tapeColors,
  workRotations,
} from "@/features/natori/constants/portfolioContent";
import { galleryFiltersFromWorks } from "@/features/natori/lib/portfolioContent";
import type { PortfolioWork } from "@/features/natori/types/portfolio";
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

// client component のため props は RSC ペイロードとして HTML ソースに埋め込まれる。
// content 丸ごとを渡すと SNS リンクや料金までソースに露出するので works だけ受け取る
// （/natori/works を営業先に見せる際にソースにも販売導線を残さないため）。
export default function PortfolioGallery({ works }: { works: PortfolioWork[] }) {
  const filters = galleryFiltersFromWorks(works);
  const [activeFilter, setActiveFilter] = useState<string>("すべて");
  const [selected, setSelected] = useState<PortfolioWork | null>(null);

  // モーダル表示中は Esc で閉じられるようにし、背景のスクロールを止める
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selected]);

  const shown =
    activeFilter === "すべて" ? works : works.filter((work) => work.tags.includes(activeFilter));

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
              {/* 作品画像。編集画面から画像を設定すると差し替わる。クリックで拡大モーダル */}
              <button
                type="button"
                onClick={work.image ? () => setSelected(work) : undefined}
                aria-label={work.image ? `${work.title} を拡大表示` : undefined}
                className={`pf-cute-focus relative mb-3 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg ${
                  work.image ? "cursor-zoom-in" : "cursor-default"
                }`}
                style={{ background: c.paperAlt }}
              >
                {work.image ? (
                  <Image
                    src={work.image}
                    alt={work.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                    // 先頭の作品はファーストビューに入る（LCP）ので優先読み込み
                    priority={index === 0}
                  />
                ) : (
                  <ChibiFace
                    size={110}
                    skin={palette.skin}
                    hair={palette.hair}
                    accent={palette.accent}
                  />
                )}
              </button>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-bold">{work.title}</p>
                {work.tags.length > 0 ? (
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {work.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-1 text-xs font-bold"
                        style={{ background: palette.accent, color: c.ink }}
                      >
                        {tag}
                      </span>
                    ))}
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

      {/* 拡大表示モーダル。背景クリック / ×ボタン / Esc で閉じる */}
      {selected?.image ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          style={{ background: "rgba(45,42,61,0.72)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-3xl flex-col rounded-xl p-3 pb-4"
            style={{ background: c.card, boxShadow: "0 20px 40px rgba(45,42,61,0.30)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="閉じる"
              className="pf-cute-focus absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full font-bold text-white shadow-md hover:brightness-105"
              style={{ background: c.pink }}
            >
              ✕
            </button>
            <div
              className="relative h-[70vh] w-full overflow-hidden rounded-lg md:h-[76vh]"
              style={{ background: c.paperAlt }}
            >
              <Image
                src={selected.image}
                alt={selected.title}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 px-1">
              <p className="min-w-0 truncate font-bold">{selected.title}</p>
              {selected.tags.length > 0 ? (
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-1 text-xs font-bold"
                      style={{ background: c.paperAlt, color: c.ink }}
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
