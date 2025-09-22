// components/natori/Gallery.tsx
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Work } from "@/lib/natori/works";

const PINK = "#FFD1E6";

type Props = { works: Work[]; tags: readonly string[] };

export default function Gallery({ works, tags }: Props) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | "ALL">("ALL");

  const filtered = useMemo(() => {
    const byTag = selected === "ALL" ? works : works.filter(w => w.tags.includes(selected));
    if (!q.trim()) return byTag;
    const kw = q.toLowerCase();
    return byTag.filter(w => w.title.toLowerCase().includes(kw) || w.description.toLowerCase().includes(kw));
  }, [works, selected, q]);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      {/* ヘッダ */}
      <div className="mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold">Selected Works</h2>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <div className="flex flex-wrap gap-2">
            <Chip label="ALL" active={selected === "ALL"} onClick={() => setSelected("ALL")} />
            {tags.map(tag => (
              <Chip key={tag} label={tag} active={selected === tag} onClick={() => setSelected(tag)} />
            ))}
          </div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="検索（タイトル・説明）"
            className="w-full rounded-full border px-4 py-2 text-sm focus:outline-none md:w-64"
            style={{ borderColor: "#F3D6E0" }}
          />
        </div>
      </div>

      {/* カードグリッド */}
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(w => (
          <li key={w.slug} className="group">
            <Link
              href={`/natori/works/${w.slug}`}
              className="block overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
              style={{ borderColor: "#F7DCE6" }}
            >
              {/* 画像フレーム：全体が見える object-contain。縦長/横長でも余白で整える */}
              <div className="w-full bg-[#FFF5F9]">
                <div className="aspect-[4/3] w-full p-3 sm:p-4">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border bg-white"
                       style={{ borderColor: "#F5D0DC" }}>
                    <img
                      src={w.image}
                      alt={w.title}
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                      decoding="async"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-medium">{w.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{w.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {w.tags.map(t => (
                    <span
                      key={t}
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{ background: "#FFE5F0", color: "#7A2843" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* === 小さな部品：チップ === */
function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-sm transition"
      style={{
        color: active ? "#7A2843" : "#6B7280",
        borderColor: active ? "transparent" : "#F3D6E0",
        background: active ? `linear-gradient(90deg, ${PINK}, #FFE5F0)` : "white",
      }}
    >
      {label}
    </button>
  );
}

