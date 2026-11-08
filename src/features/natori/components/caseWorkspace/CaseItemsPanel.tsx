"use client";
// 案件の品目（1つのご依頼の中の1点ずつ）。一覧と、1つずつの追加・編集。
// 見積・支払い・納品は案件単位のままで、ここからは変えない。
import { useEffect, useState } from "react";
import {
  CASE_ITEM_PROGRESS_LABELS,
  CASE_ITEM_PUBLICATION_LABELS,
  CASE_ITEM_TYPE_LABELS,
  caseItemFields,
  caseItemToFields,
  caseItemsTotal,
  nextCaseItemPosition,
  tokyoDateISO,
  type CaseItemFields,
} from "../../lib/caseItems";
import { caseDate } from "../../lib/caseWorkspacePresentation";
import { addCaseItem, deleteCaseItem, updateCaseItem } from "../../data/supabaseCaseItems";
import type { CaseItemsStore } from "./useCaseItems";
import type { NatoriCaseItem } from "../../types/caseItems";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { workspaceLook as look } from "../../constants/workspaceLook";

const circled = (n: number) => (n >= 1 && n <= 20 ? String.fromCodePoint(0x245f + n) : `${n}.`);
const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

type Draft = { [K in keyof CaseItemFields]: string };
const EMPTY: Draft = { title: "", projectType: "", amount: "", dueDate: "", progress: "not_started", publicationPolicy: "unknown", publicationAllowedFrom: "", note: "", handedOverAt: "" };
const toDraft = (item: NatoriCaseItem): Draft => ({
  title: item.title, projectType: item.projectType ?? "", amount: item.amount === null ? "" : String(item.amount),
  dueDate: item.dueDate ?? "", progress: item.progress, publicationPolicy: item.publicationPolicy,
  publicationAllowedFrom: item.publicationAllowedFrom ?? "", note: item.note ?? "", handedOverAt: item.handedOverAt ?? "",
});
const fromDraft = (d: Draft) =>
  caseItemFields.safeParse({
    title: d.title, projectType: d.projectType || null, amount: d.amount === "" ? null : Number(d.amount),
    dueDate: d.dueDate || null, progress: d.progress, publicationPolicy: d.publicationPolicy,
    publicationAllowedFrom: d.publicationPolicy === "delayed" ? d.publicationAllowedFrom || null : null, note: d.note || null,
    // 先渡しの日付は制作タブで付け外しする。完成でなくした品目からは外す。
    handedOverAt: d.progress === "done" ? d.handedOverAt || null : null,
  });

export function CaseItemsPanel({ projectId, store, disabled, onDraftChange }: { projectId: string; store: CaseItemsStore; disabled: boolean; onDraftChange: (dirty: boolean) => void }) {
  const { items, unavailable, busy, message, clearMessage, reload } = store;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  useEffect(() => { onDraftChange(editing !== null); return () => onDraftChange(false); }, [editing, onDraftChange]);

  const run = async (action: Parameters<CaseItemsStore["run"]>[0]) => {
    if (await store.run(action)) setEditing(null);
  };

  if (items === null) return <section className={look.panel}><p role="status" className="text-sm">品目を読み込み中…</p></section>;
  // The table may not exist yet in this environment; then the case simply has no items.
  if (unavailable) return null;
  const total = caseItemsTotal(items);
  return (
    <section className={`${look.panel} space-y-3`} aria-label="品目">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={look.sectionTitle}>品目{items.length ? <span className="ml-2 text-sm font-normal text-zinc-500">{items.length}点</span> : null}</h3>
        {total !== null && items.length > 1 ? <p className="text-sm text-zinc-600">合計 {yen(total)}</p> : null}
      </div>
      {items.length === 0 && editing !== "new" ? <p className="text-sm text-zinc-600">1つのご依頼で何点か描くときは、1点ずつ足します。</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-zinc-200/80">
            {editing === item.id ? (
              <ItemForm
                // A reload after a conflict brings a newer updatedAt; remount so the form shows those values.
                key={item.updatedAt}
                initial={toDraft(item)} busy={busy} submitLabel="保存する"
                onCancel={() => { setEditing(null); clearMessage(); }}
                onSubmit={(fields) => void run(() => updateCaseItem(projectId, item, fields))}
                onDelete={() => void run(() => deleteCaseItem(projectId, item))}
              />
            ) : (
              <button type="button" disabled={disabled || busy || editing !== null} onClick={() => setEditing(item.id)} className={`w-full rounded-xl p-3 text-left ${ui.focusRing}`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{circled(item.position)} {item.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${item.progress === "done" ? "bg-[#BE185D] text-white" : item.progress === "in_progress" ? "bg-pink-50 text-pink-900" : "bg-zinc-100 text-zinc-600"}`}>{CASE_ITEM_PROGRESS_LABELS[item.progress]}</span>
                </span>
                <span className="mt-1 block text-sm text-zinc-600">
                  {[item.projectType ? CASE_ITEM_TYPE_LABELS[item.projectType] : null, item.amount !== null ? yen(item.amount) : "金額まだ", item.dueDate ? `納期 ${caseDate(item.dueDate)}` : "納期なし"].filter(Boolean).join(" · ")}
                </span>
                {item.handedOverAt ? <span className="block text-sm text-zinc-600">先にお渡し済み（{caseDate(item.handedOverAt)}）</span> : null}
                <span className="block text-sm text-zinc-600">
                  公開：{item.publicationPolicy === "delayed" && item.publicationAllowedFrom ? `${caseDate(item.publicationAllowedFrom)}から` : CASE_ITEM_PUBLICATION_LABELS[item.publicationPolicy]}
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <div className="rounded-xl border border-zinc-200/80">
          <ItemForm initial={EMPTY} busy={busy} submitLabel="足す" onCancel={() => { setEditing(null); clearMessage(); }} onSubmit={(fields) => void run(() => addCaseItem(projectId, fields))} />
        </div>
      ) : nextCaseItemPosition(items) !== null ? (
        <button type="button" className={ui.btnSecondary} disabled={disabled || busy || editing !== null} onClick={() => setEditing("new")}>＋ 品目を足す</button>
      ) : null}
      {message ? <p role="alert" className="text-sm text-amber-900">{message} <button type="button" className="underline" onClick={() => void reload()}>読み込み直す</button></p> : null}
    </section>
  );
}

/**
 * 制作タブ：品目ごとの進みを押して変える。完成した品目は「先に渡した」を記録できる（分納）。
 * データ自体はトークで送る。正式な納品・受け取り確認は案件に1回のまま。品目が無ければ何も出さない。
 */
export function CaseItemsProgress({ projectId, store, disabled }: { projectId: string; store: CaseItemsStore; disabled: boolean }) {
  const { items, unavailable, busy, message, reload } = store;
  if (!items || unavailable || items.length === 0) return null;
  const done = items.filter((item) => item.progress === "done").length;
  const save = (item: NatoriCaseItem, patch: Partial<CaseItemFields>) => {
    const next = { ...caseItemToFields(item), ...patch };
    if (next.progress !== "done") next.handedOverAt = null;
    return store.run(() => updateCaseItem(projectId, item, next));
  };
  return (
    <section className={`${look.panel} space-y-3`} aria-label="品目の進み">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={look.sectionTitle}>品目の進み</h3>
        <p className="text-sm text-zinc-600">{done}/{items.length} 完成</p>
      </div>
      {items.length > 1 ? (
        <p className="text-xs text-zinc-600">
          仕上がった品目から先に渡せます。トークでデータを送ったら「先に渡した」を押すと、お客さまの相談ページにも「お渡し済み」と出ます。正式な納品は全部そろってから1回です。
        </p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="font-semibold">{circled(item.position)} {item.title}</span>
              {item.handedOverAt ? <span className="ml-2 text-sm text-zinc-600">{caseDate(item.handedOverAt)}にお渡し済み</span> : null}
            </span>
            <span role="group" aria-label={`${item.title}の進み`} className="flex flex-wrap gap-1">
              {(Object.keys(CASE_ITEM_PROGRESS_LABELS) as (keyof typeof CASE_ITEM_PROGRESS_LABELS)[]).map((progress) => (
                <button
                  key={progress}
                  type="button"
                  aria-pressed={item.progress === progress}
                  disabled={disabled || busy || item.progress === progress}
                  onClick={() => void save(item, { progress })}
                  className={`min-h-11 rounded-full px-3 text-sm font-semibold ${ui.focusRing} ${item.progress === progress ? "bg-[#BE185D] text-white" : "bg-zinc-100 text-zinc-700"}`}
                >
                  {CASE_ITEM_PROGRESS_LABELS[progress]}
                </button>
              ))}
              {item.progress === "done" && items.length > 1 ? (
                item.handedOverAt ? (
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => void save(item, { handedOverAt: null })}
                    className={`min-h-11 rounded-full px-3 text-sm font-semibold text-zinc-600 underline ${ui.focusRing}`}
                  >
                    お渡しを取り消す
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => void save(item, { handedOverAt: tokyoDateISO(new Date()) })}
                    className={`min-h-11 rounded-full border border-pink-300 bg-white px-3 text-sm font-semibold text-pink-900 ${ui.focusRing}`}
                  >
                    先に渡した
                  </button>
                )
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {message ? <p role="alert" className="text-sm text-amber-900">{message} <button type="button" className="underline" onClick={() => void reload()}>読み込み直す</button></p> : null}
    </section>
  );
}

function ItemForm({ initial, busy, submitLabel, onSubmit, onCancel, onDelete }: {
  initial: Draft; busy: boolean; submitLabel: string;
  onSubmit: (fields: CaseItemFields) => void; onCancel: () => void; onDelete?: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setD((v) => ({ ...v, [key]: e.target.value }));
  return (
    <form
      className="space-y-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = fromDraft(d);
        if (!parsed.success) {
          setError(d.publicationPolicy === "delayed" && !d.publicationAllowedFrom ? "公開してよい日を入れてください。" : "名前を入れ、金額は0以上の整数で入れてください。");
          return;
        }
        setError("");
        onSubmit(parsed.data);
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">名前<input className={ui.input} value={d.title} onChange={set("title")} placeholder="例：クリスマス等身" maxLength={200} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">種類
            <select className={ui.input} value={d.projectType} onChange={set("projectType")}>
              <option value="">決めていない</option>
              {Object.entries(CASE_ITEM_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm">金額（円）<input className={ui.input} type="number" inputMode="numeric" min={0} step={1} value={d.amount} onChange={set("amount")} /></label>
          <label className="block text-sm">納期<input className={ui.input} type="date" value={d.dueDate} onChange={set("dueDate")} /></label>
          <label className="block text-sm">進み
            <select className={ui.input} value={d.progress} onChange={set("progress")}>
              {Object.entries(CASE_ITEM_PROGRESS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">ポートフォリオへの公開
          <select className={ui.input} value={d.publicationPolicy} onChange={set("publicationPolicy")}>
            {Object.entries(CASE_ITEM_PUBLICATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {d.publicationPolicy === "delayed" ? (
          <label className="block text-sm">公開してよい日<input className={ui.input} type="date" value={d.publicationAllowedFrom} onChange={set("publicationAllowedFrom")} /></label>
        ) : null}
        <label className="block text-sm">メモ<textarea className={ui.input} value={d.note} onChange={set("note")} maxLength={2000} /></label>
        {error ? <p role="alert" className="text-sm text-amber-900">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button className={ui.btnPrimary}>{submitLabel}</button>
          <button type="button" className={ui.btnSecondary} onClick={onCancel}>やめる</button>
          {onDelete ? (
            confirmDelete
              ? <button type="button" className={ui.btnSecondary} onClick={onDelete}>本当に消す</button>
              : <button type="button" className={ui.btnSecondary} onClick={() => setConfirmDelete(true)}>この品目を消す</button>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
