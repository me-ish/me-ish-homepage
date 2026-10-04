"use client";

import { natoriAdminUi } from "@/features/natori/constants/adminUi";
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
    <div className="rounded-xl border border-zinc-200/80 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-700">関連リンク（任意）</p>
          <p className="mt-1 text-xs leading-4 text-zinc-500">
            ご依頼者様のSNSや、イラストが実際に使われている動画・グッズページなど。公開ポートフォリオの拡大画面だけに表示します。
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold text-zinc-400">
          {links.length}/{MAX_LINKS}
        </span>
      </div>

      {links.length > 0 ? (
        <div className="mt-3 space-y-3">
          {links.map((link, linkIndex) => (
            <div
              key={link.id}
              className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2.5"
            >
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-zinc-600">
                    種別
                    <select
                      value={link.kind}
                      onChange={(event) =>
                        updateLink(linkIndex, {
                          kind: event.target.value as PortfolioWorkLinkKind,
                        })
                      }
                      className={`${natoriAdminUi.input} mt-1`}
                    >
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold text-zinc-600">
                    表示名（任意）
                    <input
                      type="text"
                      maxLength={80}
                      value={link.label}
                      onChange={(event) => updateLink(linkIndex, { label: event.target.value })}
                      placeholder="例: YouTubeチャンネル"
                      className={`${natoriAdminUi.input} mt-1`}
                    />
                  </label>
                  <label className="block text-xs font-bold text-zinc-600 sm:col-span-2">
                    URL
                    <input
                      type="url"
                      inputMode="url"
                      value={link.href}
                      onChange={(event) => updateLink(linkIndex, { href: event.target.value })}
                      placeholder="https://..."
                      className={`${natoriAdminUi.input} mt-1`}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  aria-label={`関連リンク${linkIndex + 1}を削除`}
                  onClick={() => onChange(links.filter((_, i) => i !== linkIndex))}
                  className={`${natoriAdminUi.btnIcon} mt-0.5`}
                >
                  <Trash2 className="h-4 w-4 text-red-700" aria-hidden />
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
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        リンクを追加
      </button>
      <p className="mt-2 text-xs leading-4 text-zinc-400">
        関連リンクを保存・公開するには作品画像が必要です。URLは http:// または https:// で始まる公開ページを入力してください。
      </p>
    </div>
  );
}
