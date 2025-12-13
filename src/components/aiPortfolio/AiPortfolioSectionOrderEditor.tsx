"use client";

import React from "react";

const SECTION_LABELS: Record<string, string> = {
  hero: "HERO（トップ）",
  about: "ABOUT（自己紹介）",
  works: "WORKS（作品）",
  services: "SERVICES（サービス）",
  skills: "SKILLS（スキル）",
  contact: "CONTACT（連絡先）",
  cta: "CTA（締めメッセージ）",
};

type Props = {
  sectionOrder: string[];
  onChange: (next: string[]) => void;
};

export function AiPortfolioSectionOrderEditor({
  sectionOrder,
  onChange,
}: Props) {
  const move = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sectionOrder.length) return;

    const next = [...sectionOrder];
    const tmp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = tmp;
    onChange(next);
  };

  return (
    <section className="mt-8 rounded-xl border bg-white/70 p-4 text-left shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800">
        セクションの表示順
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        上下ボタンでセクションの順番を入れ替えると、上のプレビューにも即反映されます。
        （保存ロジックはこのあと実装予定）
      </p>

      <ul className="mt-3 space-y-2 text-sm">
        {sectionOrder.map((type, index) => (
          <li
            key={`${type}-${index}`}
            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {index + 1}
              </span>
              <span className="font-medium text-gray-800">
                {SECTION_LABELS[type] ?? type}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, +1)}
                disabled={index === sectionOrder.length - 1}
                className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
