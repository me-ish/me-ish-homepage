// src/components/card/form/steps/CardStep3Design.tsx
"use client";

import { Check } from "lucide-react";
import type { CardFormData } from "../cardFormTypes";
import { CARD_WORLDVIEWS } from "../cardFormTypes";
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";

type Props = {
  form: CardFormData;
  updateField: <K extends keyof CardFormData>(key: K, val: CardFormData[K]) => void;
};

export default function CardStep3Design({ form, updateField }: Props) {
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
          AI強度: {form.aiStrength}%
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
          <span>プリセットそのまま</span>
          <span>カスタム強め</span>
        </div>
      </div>

      {/* All features included notice */}
      <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-700">
        すべての機能が無料でご利用いただけます（作品5点、アニメーション、PDF出力、カスタムURL）
      </div>
    </div>
  );
}
