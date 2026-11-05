"use client";
// 案件の登録フォームで、1つの依頼に入っている品目（2点以上）を書き並べる。
import { Plus, X } from "lucide-react";
import { CASE_ITEM_TYPE_LABELS, NATORI_CASE_ITEM_MAX, type CaseItemDraftRow } from "../../lib/caseItems";
import { natoriAdminUi as ui } from "../../constants/adminUi";

const EMPTY: CaseItemDraftRow = { title: "", projectType: "", amount: "", dueDate: "" };

export function emptyRegistrationItems(): CaseItemDraftRow[] {
  return [{ ...EMPTY }, { ...EMPTY }];
}

export function RegistrationItemRows({
  rows,
  onChange,
}: {
  rows: CaseItemDraftRow[];
  onChange: (rows: CaseItemDraftRow[]) => void;
}) {
  const set = (index: number, patch: Partial<CaseItemDraftRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-600">
        案件の金額は品目の合計、納期はいちばん早い品目の納期になります。空けた所はあとで案件画面から入れられます。
      </p>
      <ol className="space-y-3">
        {rows.map((row, index) => (
          <li key={index} className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{index + 1}点目</span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-800 ${ui.focusRing}`}
                  aria-label={`${index + 1}点目を消す`}
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              ) : null}
            </div>
            <label className="block text-sm">
              名前
              <input className={ui.input} value={row.title} placeholder="例：立ち絵（衣装A）" onChange={(e) => set(index, { title: e.target.value })} />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="block text-sm">
                種類
                <select className={ui.input} value={row.projectType} onChange={(e) => set(index, { projectType: e.target.value })}>
                  <option value="">まだ</option>
                  {Object.entries(CASE_ITEM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                金額（円）
                <input type="number" min={0} inputMode="numeric" className={ui.input} value={row.amount} onChange={(e) => set(index, { amount: e.target.value })} />
              </label>
              <label className="block text-sm">
                納期
                <input type="date" className={ui.input} value={row.dueDate} onChange={(e) => set(index, { dueDate: e.target.value })} />
              </label>
            </div>
          </li>
        ))}
      </ol>
      {rows.length < NATORI_CASE_ITEM_MAX ? (
        <button type="button" className={ui.btnSecondary} onClick={() => onChange([...rows, { ...EMPTY }])}>
          <Plus aria-hidden="true" size={14} className="mr-1 inline" />
          品目を足す
        </button>
      ) : null}
    </div>
  );
}
