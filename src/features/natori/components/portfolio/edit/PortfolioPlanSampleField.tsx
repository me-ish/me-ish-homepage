"use client";

// features/natori/components/portfolio/edit/PortfolioPlanSampleField.tsx
// 料金プランの作例を、ご依頼実績に登録した画像付きの作品から1枚選ぶ欄。
import { useId } from "react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import type { PortfolioCollection, PortfolioWork } from "@/features/natori/types/portfolio";

export default function PortfolioPlanSampleField({
  works,
  collections,
  value,
  onChange,
}: {
  works: PortfolioWork[];
  collections: PortfolioCollection[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const id = useId();
  const candidates = works.filter((work) => Boolean(work.image));
  const selected = value ? (works.find((work) => work.id === value) ?? null) : null;
  const collectionName = (work: PortfolioWork) =>
    collections.find((collection) => collection.id === work.collectionId)?.name ?? "未分類";
  const note = !value
    ? "選ぶと、料金表のこのプランに作品の画像が出ます。"
    : !selected?.image
      ? "選んでいた作品が見つからないか、画像がありません。料金表には出ません。"
      : !selected.published
        ? "この作品は非公開のため、料金表には出ません。"
        : "料金表のこのプランに表示されます。";

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-zinc-700">
          作例（ご依頼実績から1枚）
        </label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          aria-describedby={`${id}-note`}
          className={natoriAdminUi.input}
        >
          <option value="">なし</option>
          {value && !candidates.some((work) => work.id === value) ? (
            <option value={value}>（見つからない作品）</option>
          ) : null}
          {candidates.map((work) => (
            <option key={work.id} value={work.id}>
              {`${work.title.trim() || "無題"}（${collectionName(work)}${work.published ? "" : "・非公開"}）`}
            </option>
          ))}
        </select>
        <p id={`${id}-note`} className="mt-1 text-xs text-zinc-500">
          {note}
        </p>
      </div>
      {selected?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={selected.image}
          alt=""
          className="h-20 w-16 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 object-contain"
        />
      ) : null}
    </div>
  );
}
