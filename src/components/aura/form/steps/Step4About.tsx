// src/components/aura/form/steps/Step4About.tsx
"use client";

import type { AuraFormData } from "../auraFormTypes";

const SECTION_LABELS: Record<keyof AuraFormData["sections"], string> = {
  hero: "🏠 Hero（トップ画面）",
  about: "👤 About（自己紹介）",
  works: "🎨 Works（作品一覧）",
  services: "💼 Services（サービス内容）",
  skills: "⚡ Skills（スキル）",
  contact: "📧 Contact（お問い合わせ）",
};

type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
};

export function Step4About({ data, onChange }: Props) {
  const handleSectionToggle = (key: keyof AuraFormData["sections"]) => {
    onChange({
      sections: {
        ...data.sections,
        [key]: !data.sections[key],
      },
    });
  };

  const activeSections = Object.values(data.sections).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
          自己紹介を書く
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          あなたのことを伝える文章と、表示するセクションを選びます
        </p>
      </div>

      <div className="mx-auto max-w-xl space-y-6">
        {/* 自己紹介 */}
        <div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">自己紹介文</span>
            <textarea
              value={data.bio}
              onChange={(e) => onChange({ bio: e.target.value })}
              rows={6}
              placeholder="あなたのこと、活動のこと、好きなこと。ざっくりでOK。&#10;&#10;例：&#10;・イラストレーターとして5年活動しています&#10;・キャラクターデザインが得意です&#10;・ご依頼はお気軽にどうぞ！"
              className={[
                "mt-1.5 w-full rounded-xl border px-4 py-3 text-sm transition-all",
                "bg-slate-50 placeholder:text-slate-400 border-slate-200",
                "focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100",
              ].join(" ")}
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-500">
            プロフィールセクションに表示されます。実績、対応範囲、仕事へのスタンスなどを軽く書くのがおすすめ。
          </p>
        </div>

        {/* セクション選択 */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">表示セクション</span>
            <span className="text-xs text-slate-500">{activeSections}個選択中</span>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(Object.keys(SECTION_LABELS) as (keyof AuraFormData["sections"])[]).map(
              (key) => {
                const isChecked = data.sections[key];
                return (
                  <label
                    key={key}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                      isChecked
                        ? "border-sky-300 bg-white shadow-sm"
                        : "border-transparent bg-white/50 hover:bg-white",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSectionToggle(key)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                    />
                    <span className="text-sm text-slate-700">{SECTION_LABELS[key]}</span>
                  </label>
                );
              }
            )}
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            迷ったら「Hero / Works / Contact」が最小構成。標準は「+ About」です。
          </p>
        </div>
      </div>
    </div>
  );
}
