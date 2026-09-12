"use client";

import { Plus, Trash2 } from "lucide-react";
import type {
  PortfolioWorkLink,
  PortfolioWorkLinkKind,
} from "@/features/natori/types/portfolio";

const MAX_LINKS = 6;

const KIND_OPTIONS: Array<{ value: PortfolioWorkLinkKind; label: string }> = [
  { value: "client", label: "ご依頼者様の活動先" },
  { value: "usage", label: "制作物の使用例" },
];

export default function PortfolioWorkLinksEditor({
  links,
  onChange,
}: {
  links: PortfolioWorkLink[];
  onChange: (links: PortfolioWorkLink[]) => void;
}) {
  const updateLink = (index: number, update: Partial<PortfolioWorkLink>) => {
    onChange(links.map((link, i) => (i === index ? { ...link, ...update } : link)));
  };

  return (
    <div className="rounded-xl border border-pink-100 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-pink-700">関連リンク（任意）</p>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            ご依頼者様のSNSや、イラストが実際に使われている動画・グッズページなど。公開ポートフォリオの拡大画面だけに表示します。
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-gray-400">
          {links.length}/{MAX_LINKS}
        </span>
      </div>

      {links.length > 0 ? (
        <div className="mt-3 space-y-3">
          {links.map((link, linkIndex) => (
            <div
              key={link.id}
              className="rounded-lg border border-pink-100 bg-pink-50/30 p-2.5"
            >
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <label className="block text-[11px] font-bold text-gray-600">
                    種別
                    <select
                      value={link.kind}
                      onChange={(event) =>
                        updateLink(linkIndex, {
                          kind: event.target.value as PortfolioWorkLinkKind,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-pink-200 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    >
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] font-bold text-gray-600">
                    表示名（任意）
                    <input
                      type="text"
                      maxLength={80}
                      value={link.label}
                      onChange={(event) => updateLink(linkIndex, { label: event.target.value })}
                      placeholder="例: YouTubeチャンネル"
                      className="mt-1 w-full rounded-lg border border-pink-200 bg-white px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-gray-600 sm:col-span-2">
                    URL
                    <input
                      type="url"
                      inputMode="url"
                      value={link.href}
                      onChange={(event) => updateLink(linkIndex, { href: event.target.value })}
                      placeholder="https://..."
                      className="mt-1 w-full rounded-lg border border-pink-200 bg-white px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  aria-label={`関連リンク${linkIndex + 1}を削除`}
                  onClick={() => onChange(links.filter((_, i) => i !== linkIndex))}
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-red-100 bg-white text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        disabled={links.length >= MAX_LINKS}
        onClick={() =>
          onChange([
            ...links,
            {
              id: `work-link-${crypto.randomUUID()}`,
              kind: "client",
              label: "",
              href: "",
            },
          ])
        }
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-pink-300 bg-white px-3.5 py-2 text-xs font-bold text-pink-700 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-pink-300"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        リンクを追加
      </button>
      <p className="mt-2 text-[11px] text-gray-400">
        URLは http:// または https:// で始まる公開ページを入力してください。
      </p>
    </div>
  );
}
