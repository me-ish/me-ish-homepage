"use client";
// 作品を案件の品目に結ぶ欄。結ぶと、品目の「公開してよい日」までサイトに出ない。
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { caseItemPublicationNote } from "@/features/natori/lib/caseItems";
import type { NatoriLinkableCaseItem } from "@/features/natori/types/caseItems";

const circled = (n: number) =>
  n >= 1 && n <= 20 ? String.fromCodePoint(0x245f + n) : `${n}.`;

export function PortfolioWorkCaseItemField({
  value,
  options,
  today,
  onChange,
}: {
  value: string | null;
  /** null は読み込めなかった（または見本の画面）。 */
  options: readonly NatoriLinkableCaseItem[] | null;
  today: string;
  onChange: (caseItemId: string | null) => void;
}) {
  if (options === null && !value) return null;
  const linked = value
    ? (options?.find((item) => item.id === value) ?? null)
    : null;
  const note = value && options ? caseItemPublicationNote(linked, today) : null;
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700">
        案件の品目に結ぶ
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          className={`${natoriAdminUi.input} mt-1`}
          disabled={options === null}
        >
          <option value="">
            結ばない（公開するかは上のチェックだけで決まる）
          </option>
          {value && !linked ? (
            <option value={value}>見つからない品目</option>
          ) : null}
          {(options ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.caseTitle} {circled(item.position)} {item.title}
            </option>
          ))}
        </select>
      </label>
      {options === null && value ? (
        <p className="mt-1 text-xs text-zinc-600">
          品目を読み込めませんでした。結んだままにしてあります。
        </p>
      ) : note ? (
        <p
          className={`mt-1 text-xs ${note.open ? "text-zinc-600" : "text-amber-900"}`}
        >
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
