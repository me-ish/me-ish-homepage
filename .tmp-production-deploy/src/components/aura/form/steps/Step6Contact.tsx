// src/components/aura/form/steps/Step6Contact.tsx
"use client";

import type { AuraFormData } from "../auraFormTypes";

type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
};

export function Step6Contact({ data, onChange }: Props) {
  const filledCount = [data.contactEmail, data.twitter, data.instagram, data.behance, data.website].filter(
    (v) => v.trim()
  ).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
          連絡先＆SNS
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          ポートフォリオに表示するリンクを入力してください
        </p>
      </div>

      <div className="mx-auto max-w-md space-y-4">
        {/* Email */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all focus-within:border-sky-400 focus-within:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
              @
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">メールアドレス</span>
                <span className="text-[10px] text-slate-400">任意・公開されます</span>
              </div>
              <input
                type="email"
                value={data.contactEmail}
                onChange={(e) => onChange({ contactEmail: e.target.value })}
                placeholder="contact@example.com"
                className="mt-1 w-full border-none bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* X (Twitter) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all focus-within:border-sky-400 focus-within:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              X
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">X（旧Twitter）</span>
                <span className="text-[10px] text-slate-400">任意</span>
              </div>
              <input
                type="text"
                value={data.twitter}
                onChange={(e) => onChange({ twitter: e.target.value })}
                placeholder="@your_id または https://x.com/your_id"
                className="mt-1 w-full border-none bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Instagram */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all focus-within:border-sky-400 focus-within:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-400 text-sm font-bold text-white">
              IG
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Instagram</span>
                <span className="text-[10px] text-slate-400">任意</span>
              </div>
              <input
                type="text"
                value={data.instagram}
                onChange={(e) => onChange({ instagram: e.target.value })}
                placeholder="@your_id または https://instagram.com/your_id"
                className="mt-1 w-full border-none bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Behance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all focus-within:border-sky-400 focus-within:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              Be
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Behance</span>
                <span className="text-[10px] text-slate-400">任意</span>
              </div>
              <input
                type="text"
                value={data.behance}
                onChange={(e) => onChange({ behance: e.target.value })}
                placeholder="your_id または https://behance.net/your_id"
                className="mt-1 w-full border-none bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Website */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 transition-all focus-within:border-sky-400 focus-within:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white">
              🌐
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Webサイト</span>
                <span className="text-[10px] text-slate-400">任意</span>
              </div>
              <input
                type="text"
                value={data.website}
                onChange={(e) => onChange({ website: e.target.value })}
                placeholder="your-site.com または https://your-site.com"
                className="mt-1 w-full border-none bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* ヒント */}
        <p className="text-center text-xs text-slate-500">
          {filledCount === 0 ? (
            "リンクはなくても大丈夫です"
          ) : (
            <span className="text-sky-600">{filledCount}件のリンクが追加されます</span>
          )}
        </p>
      </div>
    </div>
  );
}
