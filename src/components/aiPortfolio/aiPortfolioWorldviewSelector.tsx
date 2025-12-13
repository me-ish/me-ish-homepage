// src/components/aiPortfolio/aiPortfolioWorldviewSelector.tsx
"use client";

import React, { CSSProperties, useState } from "react";
import type { WorldviewBase } from "@/lib/aiPortfolio/aiPortfolio.worldviewPresets";

type Props = {
  /** FormData に渡す name。今回は "worldviewBase" を想定 */
  name: string;
  /** 初期選択値（未指定時は "business"） */
  defaultValue?: WorldviewBase;
  /** 選択変更時に親へ通知（プリセット反映用） */
  onChange?: (id: WorldviewBase) => void;
};

/**
 * 世界観ごとのカード表示用情報
 * （プリセット本体は aiPortfolio.worldviewPresets.ts 側で管理）
 */
const WORLDVIEW_CARD_META: {
  id: WorldviewBase;
  label: string;
  shortLabel: string;
  description: string;
  baseColor: string;
  accentColor: string;
  textColor: string;
}[] = [
  {
    id: "minimal",
    label: "minimal（余白多め）",
    shortLabel: "MINIMAL",
    description: "余白と整列を重視した、静かな世界観",
    baseColor: "#F9FAFB",
    accentColor: "#6B7280",
    textColor: "#111827",
  },
  {
    id: "modern",
    label: "modern（ネイビー）",
    shortLabel: "MODERN",
    description: "ネイビー×グレーの今っぽいシンプルさ",
    baseColor: "#0F172A",
    accentColor: "#38BDF8",
    textColor: "#E5E7EB",
  },
  {
    id: "business",
    label: "business（青×白）",
    shortLabel: "BUSINESS",
    description: "信頼感のある青系ベースのビジネス寄り",
    baseColor: "#EFF6FF",
    accentColor: "#2563EB",
    textColor: "#111827",
  },
  {
    id: "cute",
    label: "cute（ピンク）",
    shortLabel: "CUTE",
    description: "丸みとピンクを使った、やわらかい雰囲気",
    baseColor: "#FEF2F2",
    accentColor: "#FB7185",
    textColor: "#111827",
  },
  {
    id: "pop",
    label: "pop（ビビッド）",
    shortLabel: "POP",
    description: "元気な色で明るく楽しい印象",
    baseColor: "#FEF3C7",
    accentColor: "#F97316",
    textColor: "#111827",
  },
  {
    id: "dark",
    label: "dark（ダーク）",
    shortLabel: "DARK",
    description: "暗めトーンで、落ち着きと重さのある世界観",
    baseColor: "#020617",
    accentColor: "#F97316",
    textColor: "#F9FAFB",
  },
  {
    id: "cyber",
    label: "cyber（ネオン）",
    shortLabel: "CYBER",
    description: "黒ベース＋ネオンのデジタル感",
    baseColor: "#020617",
    accentColor: "#22D3EE",
    textColor: "#E5E7EB",
  },
  {
    id: "natural",
    label: "natural（グリーン）",
    shortLabel: "NATURAL",
    description: "グリーンやベージュのナチュラルテイスト",
    baseColor: "#ECFDF3",
    accentColor: "#22C55E",
    textColor: "#14532D",
  },
  {
    id: "luxury",
    label: "luxury（黒×金）",
    shortLabel: "LUXURY",
    description: "黒とゴールドで少しリッチな印象",
    baseColor: "#020617",
    accentColor: "#FACC15",
    textColor: "#FEFCE8",
  },
  {
    id: "retro",
    label: "retro（レトロ）",
    shortLabel: "RETRO",
    description: "生成りやマスタードのレトロ感",
    baseColor: "#FFFBEB",
    accentColor: "#D97706",
    textColor: "#78350F",
  },
];

/**
 * 世界観カード用の簡易パターン（背景の柄をうっすら）
 */
function cardPatternStyle(id: WorldviewBase, accent: string): CSSProperties {
  switch (id) {
    case "minimal":
      return {
        backgroundImage: `
          linear-gradient(${accent}14 1px, transparent 1px),
          linear-gradient(90deg, ${accent}14 1px, transparent 1px)
        `,
        backgroundSize: "18px 18px",
      };
    case "modern":
      return {
        backgroundImage: `
          linear-gradient(135deg, ${accent}33 0, transparent 60%)
        `,
      };
    case "business":
      return {
        backgroundImage: `
          repeating-linear-gradient(
            90deg,
            ${accent}12,
            ${accent}12 2px,
            transparent 2px,
            transparent 10px
          )
        `,
        backgroundSize: "18px 18px",
      };
    case "cute":
      return {
        backgroundImage: `
          radial-gradient(${accent}26 3px, transparent 3px)
        `,
        backgroundSize: "18px 18px",
      };
    case "pop":
      return {
        backgroundImage: `
          radial-gradient(circle at 0 0, ${accent}26 0, transparent 60%),
          radial-gradient(circle at 100% 100%, ${accent}26 0, transparent 60%)
        `,
        backgroundSize: "60px 60px",
      };
    case "dark":
      return {
        backgroundImage: `
          radial-gradient(circle at 0 0, ${accent}33 0, transparent 60%),
          radial-gradient(circle at 100% 100%, ${accent}33 0, transparent 60%)
        `,
        backgroundSize: "80px 80px",
      };
    case "cyber":
      return {
        backgroundImage: `
          linear-gradient(${accent}40 1px, transparent 1px),
          linear-gradient(90deg, ${accent}40 1px, transparent 1px)
        `,
        backgroundSize: "16px 16px",
      };
    case "natural":
      return {
        backgroundImage: `
          radial-gradient(circle at 0 0, ${accent}1f 0, transparent 60%),
          radial-gradient(circle at 100% 100%, ${accent}1f 0, transparent 60%)
        `,
        backgroundSize: "72px 72px",
      };
    case "luxury":
      return {
        backgroundImage: `
          repeating-linear-gradient(
            135deg,
            ${accent}33,
            ${accent}33 2px,
            transparent 2px,
            transparent 8px
          )
        `,
        backgroundSize: "22px 22px",
      };
    case "retro":
      return {
        backgroundImage: `
          radial-gradient(${accent}26 2px, transparent 2px)
        `,
        backgroundSize: "22px 22px",
      };
    default:
      return {};
  }
}

const AiPortfolioWorldviewSelector: React.FC<Props> = ({
  name,
  defaultValue = "business",
  onChange,
}) => {
  const [value, setValue] = useState<WorldviewBase>(defaultValue);

  const handleSelect = (id: WorldviewBase) => {
    setValue(id);
    onChange?.(id);
  };

  return (
    <div className="space-y-2">
      {/* hidden input：FormData 用 */}
      <input type="hidden" name={name} value={value} />

      {/* スマホ：横スクロール / PC：折り返し */}
      <div className="w-full overflow-x-auto md:overflow-visible">
        <div className="flex gap-3 py-1 pr-2 md:flex-wrap md:pr-0">
          {WORLDVIEW_CARD_META.map((opt) => {
            const selected = opt.id === value;

            const cardStyle: CSSProperties = {
              backgroundColor: opt.baseColor,
              color: opt.textColor,
              borderColor: selected
                ? opt.accentColor
                : "rgba(148,163,184,0.6)",
              boxShadow: selected
                ? `0 14px 30px rgba(15,23,42,0.35), 0 0 0 2px ${opt.accentColor}`
                : "0 2px 6px rgba(15,23,42,0.08)",
              ...cardPatternStyle(opt.id, opt.accentColor),
            };

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
className={[
  "group relative flex h-[120px] w-[170px] flex-none flex-col justify-between rounded-xl border p-3 text-left text-xs",
  "transition-all duration-200 ease-out",
  "md:h-[130px] md:w-[180px] md:flex-auto",
  selected
    ? "scale-[1.03]"
    : "hover:-translate-y-[2px] hover:shadow-[0_10px_26px_rgba(15,23,42,0.18)]",
].join(" ")}

                style={cardStyle}
              >
                <div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 group-hover:bg-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 group-hover:animate-pulse" />
                    <span>{opt.shortLabel}</span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold">
                    {opt.label}
                  </p>
                  <p className="mt-1 text-[11px] opacity-80">
                    {opt.description}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className="inline-flex h-5 w-5 rounded-full border"
                    style={{
                      backgroundColor: opt.accentColor,
                      borderColor: "rgba(15,23,42,0.2)",
                    }}
                  />
                  {selected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-slate-50 backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      <span>選択中</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-gray-500">
        ぱっと見の「雰囲気」だけ直感で選んでOKです。細かい質感やレイアウトはAIが調整します。
      </p>
    </div>
  );
};

export default AiPortfolioWorldviewSelector;
