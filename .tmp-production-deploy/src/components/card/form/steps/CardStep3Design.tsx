// src/components/card/form/steps/CardStep3Design.tsx
"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import type { CardFormData } from "../cardFormTypes";
import { CARD_WORLDVIEWS } from "../cardFormTypes";
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";
import {
  blendColor,
  saturateColor,
  desaturateColor,
} from "@/lib/card/card.colorUtils";

type Props = {
  form: CardFormData;
  updateField: <K extends keyof CardFormData>(key: K, val: CardFormData[K]) => void;
};

function getAiLabel(v: number): string {
  if (v <= 29) return "シンプル";
  if (v >= 71) return "ダイナミック";
  return "バランス";
}

export default function CardStep3Design({ form, updateField }: Props) {
  // Compute mini preview colors based on worldview x aiStrength
  const preview = useMemo(() => {
    const preset = getWorldviewPreset(form.worldview);
    const v = form.aiStrength;
    let primary = preset.colorPrimary;
    let accent = preset.colorAccent;
    let bg = preset.colorBG;
    let gradient = preset.bgGradient;

    if (v <= 29) {
      primary = desaturateColor(primary, 0.4);
      accent = desaturateColor(accent, 0.4);
      gradient = undefined;
    } else if (v >= 71) {
      primary = saturateColor(primary, 0.3);
      accent = saturateColor(accent, 0.3);
      accent = blendColor(accent, primary, ((v - 70) / 30) * 0.3);
      if (!gradient || gradient === "none") {
        gradient = `linear-gradient(135deg, ${bg}, ${blendColor(bg, primary, 0.08)})`;
      }
    }

    return { primary, accent, bg, text: preset.colorText, gradient };
  }, [form.worldview, form.aiStrength]);

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-bold text-slate-800">
        デザイン設定
      </h2>

      {/* Worldview selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">
          世界観を選択
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {CARD_WORLDVIEWS.map((wv) => {
            const preset = getWorldviewPreset(wv.id);
            const selected = form.worldview === wv.id;
            return (
              <button
                key={wv.id}
                type="button"
                onClick={() => updateField("worldview", wv.id)}
                className={`
                  relative rounded-xl p-3 text-left transition-all duration-200
                  border-2
                  ${
                    selected
                      ? "border-sky-500 shadow-md shadow-sky-100 scale-[1.02]"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }
                `}
                style={{
                  backgroundColor: preset.colorBG,
                  color: preset.colorText,
                }}
              >
                {/* Color accent dot */}
                <div
                  className="w-6 h-6 rounded-full mb-2 border border-black/10"
                  style={{ backgroundColor: preset.colorPrimary }}
                />

                <span className="text-xs font-bold block">
                  {wv.emoji} {wv.label}
                </span>

                {selected && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Strength slider */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          デザイン強度: {form.aiStrength}%
          <span className="ml-2 text-xs font-normal text-slate-400">
            — {getAiLabel(form.aiStrength)}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={form.aiStrength}
          onChange={(e) => updateField("aiStrength", Number(e.target.value))}
          className="w-full accent-sky-500"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>シンプル</span>
          <span>バランス</span>
          <span>ダイナミック</span>
        </div>

        {/* Mini preview swatch */}
        <div
          className="mt-3 rounded-lg p-3 flex items-center gap-3 transition-all duration-300"
          style={{
            backgroundColor: preview.bg,
            backgroundImage: preview.gradient && preview.gradient !== "none" ? preview.gradient : undefined,
            color: preview.text,
          }}
        >
          <div
            className="w-8 h-8 rounded-full shrink-0 border border-black/10"
            style={{ backgroundColor: preview.primary }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-bold truncate"
              style={{ color: preview.text }}
            >
              {form.name || "サンプル名前"}
            </div>
            <div
              className="text-[10px] opacity-60 truncate"
              style={{ color: preview.text }}
            >
              {form.title || "肩書き"}
            </div>
          </div>
          <div
            className="w-6 h-6 rounded shrink-0 border border-black/10"
            style={{ backgroundColor: preview.accent }}
          />
        </div>
      </div>

      {/* All features included notice */}
      <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-700">
        すべての機能が無料でご利用いただけます（作品6点、アニメーション、PDF出力、カスタムURL）
      </div>
    </div>
  );
}
