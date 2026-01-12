// src/components/aiPortfolio/form/steps/Step5ServicesSkills.tsx
"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { AuraFormData } from "../auraFormTypes";

const SKILL_PRESETS = [
  "イラスト",
  "キャラクターデザイン",
  "一枚絵",
  "立ち絵",
  "背景イラスト",
  "SDキャラ",
  "アイコン制作",
  "SNSヘッダー",
  "ゲームイラスト",
  "Live2D",
  "VTuberデザイン",
  "ロゴデザイン",
  "バナー制作",
  "同人誌表紙",
  "グッズデザイン",
];

type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
};

export function Step5ServicesSkills({ data, onChange }: Props) {
  const [newService, setNewService] = useState({ name: "", price: "", desc: "" });

  // サービス追加
  const handleAddService = () => {
    if (!newService.name.trim()) return;
    onChange({
      services: [
        ...data.services,
        {
          name: newService.name.trim(),
          price: newService.price.trim() || undefined,
          desc: newService.desc.trim() || undefined,
        },
      ],
    });
    setNewService({ name: "", price: "", desc: "" });
  };

  // サービス削除
  const handleRemoveService = (index: number) => {
    onChange({
      services: data.services.filter((_, i) => i !== index),
    });
  };

  // スキルプリセットトグル
  const toggleSkillPreset = (skill: string) => {
    const current = data.skillPresets;
    if (current.includes(skill)) {
      onChange({ skillPresets: current.filter((s) => s !== skill) });
    } else {
      onChange({ skillPresets: [...current, skill] });
    }
  };

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
          サービス＆スキル
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          提供できるサービスや得意なスキルを追加しましょう
        </p>
      </div>

      <div className="mx-auto max-w-xl space-y-8">
        {/* サービス */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-700">
            提供サービス（任意）
          </h3>

          {/* 既存サービス一覧 */}
          {data.services.length > 0 && (
            <div className="mb-4 space-y-2">
              {data.services.map((service, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{service.name}</div>
                    {service.price && (
                      <div className="text-xs text-sky-600">{service.price}</div>
                    )}
                    {service.desc && (
                      <div className="text-xs text-slate-500">{service.desc}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveService(index)}
                    className="ml-2 rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 新規サービス追加フォーム */}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="space-y-3">
              <input
                type="text"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder="サービス名（例：イラスト制作）"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newService.price}
                  onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                  placeholder="料金（例：¥10,000〜）"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <input
                  type="text"
                  value={newService.desc}
                  onChange={(e) => setNewService({ ...newService, desc: e.target.value })}
                  placeholder="補足（任意）"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <button
                type="button"
                onClick={handleAddService}
                disabled={!newService.name.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                サービスを追加
              </button>
            </div>
          </div>
        </div>

        {/* スキル */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-slate-700">スキルタグ</h3>

          {/* プリセット */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-[11px] text-slate-500">よく使われるスキル：</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_PRESETS.map((skill) => {
                const isActive = data.skillPresets.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkillPreset(skill)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                      isActive
                        ? "border-sky-400 bg-sky-500 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600",
                    ].join(" ")}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 手動入力 */}
          <div className="mt-3">
            <input
              type="text"
              value={data.manualSkills}
              onChange={(e) => onChange({ manualSkills: e.target.value })}
              placeholder="その他スキル（カンマ区切り）例: アニメ塗り, 厚塗り, ローファイテイスト"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              選んだタグと入力したスキルがまとめて表示されます（目安: 5〜12個）
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
