// src/components/aiPortfolio/form/steps/Step2Design.tsx
"use client";

import { useMemo } from "react";
import type { WorldviewBase } from "@/lib/aiPortfolio/aiPortfolio.worldviewPresets";
import { getWorldviewPreset } from "@/lib/aiPortfolio/aiPortfolio.worldviewPresets";
import type { AuraFormData } from "../auraFormTypes";

const WORLDVIEWS: WorldviewBase[] = [
  "minimal",
  "modern",
  "business",
  "cute",
  "pop",
  "dark",
  "cyber",
  "natural",
  "luxury",
  "retro",
];

const WORLDVIEW_META: Record<WorldviewBase, { label: string; desc: string; colors: { primary: string; accent: string; bg: string } }> = {
  minimal: { label: "Minimal", desc: "シンプル＆洗練", colors: { primary: "#111827", accent: "#6B7280", bg: "#F9FAFB" } },
  modern: { label: "Modern", desc: "先進的＆クール", colors: { primary: "#38BDF8", accent: "#94A3B8", bg: "#020617" } },
  business: { label: "Business", desc: "信頼感＆プロ", colors: { primary: "#2563EB", accent: "#0F172A", bg: "#EFF6FF" } },
  cute: { label: "Cute", desc: "かわいい＆親しみ", colors: { primary: "#FB7185", accent: "#FDBA74", bg: "#FEF2F2" } },
  pop: { label: "Pop", desc: "元気＆カラフル", colors: { primary: "#F97316", accent: "#EC4899", bg: "#FEF3C7" } },
  dark: { label: "Dark", desc: "クール＆神秘的", colors: { primary: "#F97316", accent: "#E5E7EB", bg: "#020617" } },
  cyber: { label: "Cyber", desc: "未来的＆ネオン", colors: { primary: "#22D3EE", accent: "#A855F7", bg: "#020617" } },
  natural: { label: "Natural", desc: "自然＆温かみ", colors: { primary: "#22C55E", accent: "#A3E635", bg: "#ECFDF3" } },
  luxury: { label: "Luxury", desc: "高級＆エレガント", colors: { primary: "#FACC15", accent: "#FEFCE8", bg: "#020617" } },
  retro: { label: "Retro", desc: "レトロ＆ノスタルジック", colors: { primary: "#D97706", accent: "#78350F", bg: "#FFFBEB" } },
};

type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
};

export function Step2Design({ data, onChange }: Props) {

  const handleWorldviewSelect = (wv: WorldviewBase) => {
    const preset = getWorldviewPreset(wv);
    onChange({
      worldviewBase: wv,
      patternBase: preset.patternBase,
      surfaceStyle: preset.surfaceStyle,
      showcaseStyle: preset.showcaseStyle,
      layoutPref: preset.layoutPref,
      languageMode: preset.languageMode,
      fontPreset: preset.fontPreset,
    });
  };

  // 調整度の説明テキスト
  const strengthLabel = useMemo(() => {
    const s = data.aiSwing;
    if (s <= 20) return "あなたの指定を忠実に反映";
    if (s <= 60) return "世界観に沿ってバランス調整";
    if (s < 100) return "世界観を活かしつつ自由にアレンジ";
    return "フル自動でおまかせ";
  }, [data.aiSwing]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
          世界観を選ぶ
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          あなたの作風に合うテンプレートを選んでください
        </p>
      </div>

      {/* 世界観グリッド */}
      <div className="mx-auto max-w-2xl">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {WORLDVIEWS.map((wv) => {
            const meta = WORLDVIEW_META[wv];
            const isSelected = data.worldviewBase === wv;

            return (
              <button
                key={wv}
                type="button"
                onClick={() => handleWorldviewSelect(wv)}
                className={[
                  "group relative flex flex-col overflow-hidden rounded-2xl border-2 p-3 text-left transition-all",
                  isSelected
                    ? "border-sky-500 bg-sky-50 shadow-lg shadow-sky-200/50"
                    : "border-slate-200 bg-white hover:border-sky-300 hover:shadow-md",
                ].join(" ")}
              >
                {/* 背景カラープレビュー */}
                <div
                  className="mb-2 h-12 w-full rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${meta.colors.bg} 0%, ${meta.colors.primary}22 100%)`,
                  }}
                >
                  <div className="flex h-full items-center justify-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-full shadow-sm"
                      style={{ backgroundColor: meta.colors.primary }}
                    />
                    <span
                      className="h-3 w-3 rounded-full shadow-sm"
                      style={{ backgroundColor: meta.colors.accent }}
                    />
                  </div>
                </div>

                {/* ラベル */}
                <span
                  className={[
                    "text-sm font-semibold",
                    isSelected ? "text-sky-700" : "text-slate-800",
                  ].join(" ")}
                >
                  {meta.label}
                </span>
                <span className="text-[10px] text-slate-500">{meta.desc}</span>

                {/* 選択インジケーター */}
                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* 調整度スライダー */}
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">調整度</span>
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
            {data.aiSwing}%
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={data.aiSwing}
          onChange={(e) => onChange({ aiSwing: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-500"
        />

        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
          <span>指定通り</span>
          <span>おまかせ</span>
        </div>

        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-center text-xs text-slate-600">
          {strengthLabel}
        </p>
      </div>
    </div>
  );
}
