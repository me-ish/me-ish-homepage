"use client";
import { useEffect, useRef, useState } from "react";
import { loadCaseContext } from "../../data/supabaseCaseScreen";
import { submitCaseAdministration } from "../../data/supabaseCaseAdministration";
import { normalizeNatoriReferenceUrl } from "../../lib/referenceLinks";
import { useCaseDraft } from "./useCaseDraft";
import { useCaseAdminOperation } from "./useCaseAdminOperation";
import { CaseAdminConfirmation } from "./CaseAdministrationPanel";
import { caseRegistration } from "../../lib/caseAdministration";
import { calculateDueDate } from "../../lib/deliveryPlans";
import { Plus } from "lucide-react";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { addCaseItem } from "../../data/supabaseCaseItems";
import { caseItemDraftToFields, readCaseItemDraft, type CaseItemFields } from "../../lib/caseItems";
import { emptyRegistrationItems, RegistrationItemRows } from "./RegistrationItemRows";
import { workspaceLook as look } from "../../constants/workspaceLook";
/** Where an order taken outside the site came from. Kept in the request text and as the trade page link's name. */
const TYPE_LABELS: Record<string, string> = { icon: "アイコン", sd: "SD", standing: "立ち絵", illustration: "イラスト" };
const PLACES = ["つなぐ", "ココナラ", "Skeb", "X", "メール", "その他"] as const;
export function CaseRegistration({
  today,
  onChanged,
  onDraftChange,
  onOpen,
}: {
  today: string;
  onChanged: () => void;
  onDraftChange: (v: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const [opDirty, setOpDirty] = useState(false),
    [formDirty, setFormDirty] = useState(false);
  const operation = useCaseAdminOperation(
    "natori-case-admin/new",
    onChanged,
    setOpDirty,
  );
  const [form, setForm, reset] = useCaseDraft(
    "natori-case-draft/new-registration",
    {
      mode: "external",
      title: "",
      clientName: "",
      clientEmail: "",
      type: "illustration",
      status: "inquiry",
      amount: "0",
      deliveryPlan: "normal",
      startDate: today,
      dueDate: calculateDueDate(today, "normal"),
      note: "",
      place: "つなぐ",
      tradeUrl: "",
      externalType: "",
      externalAmount: "",
      externalDue: "",
      externalMulti: "",
      externalItems: "",
    },
    setFormDirty,
  );
  // Both the tab draft and frozen command participate in the workspace leaving guard.
  // Callback identities are stable state setters supplied by the workspace.
  const dirty = opDirty || formDirty;
  // The trade page link is saved right after the case exists, as its first 参考リンク.
  const [linkNote, setLinkNote] = useState("");
  const linkSent = useRef<string | null>(null);
  const pendingLink = useRef<{ url: string; label: string } | null>(null);
  useEffect(() => {
    const id = operation.done ? operation.projectId : null, link = pendingLink.current;
    if (!id || !link || linkSent.current === id) return;
    linkSent.current = id;
    pendingLink.current = null;
    void loadCaseContext(id)
      .then(context => submitCaseAdministration({ operationId: crypto.randomUUID(), projectId: id, revision: context.revision,
        action: { command: "reference-link", mode: "add", linkId: null, url: link.url, label: link.label } }))
      .then(result => setLinkNote(["applied", "unchanged"].includes(result.result) ? "" : "取引ページのリンクは保存できませんでした。相談の参考リンクから足してください。"))
      .catch(() => setLinkNote("取引ページのリンクは保存できたか分かりません。相談の参考リンクを見てください。"));
  }, [operation.done, operation.projectId]);
  // 2点以上の依頼は、案件ができたあとに品目を1つずつ足す（案件本体には触らない）。
  const [itemsNote, setItemsNote] = useState("");
  const itemsSent = useRef<string | null>(null);
  const pendingItems = useRef<CaseItemFields[] | null>(null);
  useEffect(() => {
    const id = operation.done ? operation.projectId : null, items = pendingItems.current;
    if (!id || !items?.length || itemsSent.current === id) return;
    itemsSent.current = id;
    pendingItems.current = null;
    void (async () => {
      for (const [index, item] of items.entries()) {
        const result = await addCaseItem(id, item);
        if (result.kind !== "ok") {
          setItemsNote(`品目は${index}点まで保存できました。残りは案件画面の「品目」から足してください。`);
          return;
        }
      }
      setItemsNote("");
    })();
  }, [operation.done, operation.projectId]);
  // Closed, only the small button sits at the end of the heading row; open, the form takes the full width below it.
  const wide = open || !!operation.saved || operation.blocked;
  return (
    <section
      aria-label="新しい案件の登録"
      className={wide ? `basis-full space-y-3 ${look.card}` : "ml-auto"}
    >
      <RegistrationDirty dirty={dirty} onChange={onDraftChange} />
      <button
        type="button"
        className={`inline-flex h-9 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition-colors ${ui.focusRing} ${open ? "border-pink-300 bg-pink-50 text-pink-900" : "border-zinc-200 bg-white text-zinc-700 hover:border-pink-300"}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Plus aria-hidden="true" size={14} />
        案件を登録
      </button>
      <CaseAdminConfirmation operation={operation} />
      {linkNote ? <p role="alert" className="text-sm">{linkNote}</p> : null}
      {itemsNote ? <p role="alert" className="text-sm">{itemsNote}</p> : null}
      {operation.done && operation.projectId ? (
        <button
          className={ui.btnSecondary}
          onClick={() => {
            const id = operation.projectId!;
            operation.close();
            reset({
              ...form,
              title: "",
              clientName: "",
              clientEmail: "",
              note: "",
              tradeUrl: "",
              externalType: "",
              externalAmount: "",
              externalDue: "",
              externalMulti: "",
              externalItems: "",
            });
            setLinkNote("");
            setItemsNote("");
            onOpen(id);
          }}
        >
          登録した案件を開く
        </button>
      ) : null}
      {open && !operation.saved && !operation.blocked ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const external = form.mode === "external";
              const multi = external && form.externalMulti === "1";
              const drafted = multi ? caseItemDraftToFields(readCaseItemDraft(form.externalItems)) : null;
              if (drafted?.kind === "error") {
                setError(drafted.message);
                return;
              }
              const itemPlan = drafted?.kind === "ok" ? drafted : null;
              if (multi && !itemPlan?.items.length) {
                setError("品目の名前を1つ以上入れてください。");
                return;
              }
              const decided = itemPlan ? itemPlan.type !== null : external && form.externalType !== "" && form.externalAmount !== "";
              if (external && !multi && !decided && (form.externalType !== "" || form.externalAmount !== "" || form.externalDue !== "")) {
                setError("種類と金額は、両方入れるか両方空にしてください。");
                return;
              }
              if (external && form.tradeUrl.trim() && !normalizeNatoriReferenceUrl(form.tradeUrl.trim())) {
                setError("取引ページは https:// で始まるURLを入れてください。");
                return;
              }
              const { place, tradeUrl, externalType, externalAmount, externalDue, externalMulti: _multi, externalItems: _items, ...fields } = form;
              void _multi; void _items;
              const note = external ? `受けた場所：${place}${fields.note.trim() ? `\n\n${fields.note}` : ""}` : fields.note;
              const data = caseRegistration.parse(decided ? {
                ...fields, mode: "manual",
                type: itemPlan ? itemPlan.type : externalType,
                amount: itemPlan ? itemPlan.amount : Number(externalAmount), status: "inquiry",
                deliveryPlan: "normal", startDate: today, dueDate: (itemPlan ? itemPlan.dueDate : externalDue) || null, note,
              } : { ...fields, amount: Number(fields.amount), note });
              pendingItems.current = itemPlan ? itemPlan.items : null;
              itemsSent.current = null;
              setItemsNote("");
              pendingLink.current = external && tradeUrl.trim() ? { url: tradeUrl.trim(), label: `${place}の取引ページ` } : null;
              linkSent.current = null;
              setLinkNote("");
              operation.prepare(
                {
                  operationId: crypto.randomUUID(),
                  projectId: null,
                  revision: null,
                  action: { command: "create", data },
                },
                [
                  `登録のしかた：${external ? `サイトの外で受けた依頼（${place}）` : "決まっている案件を登録"}`,
                  `案件：${data.title} / お客さん：${data.clientName}`,
                  `メール：${data.clientEmail || "なし"}`,
                  ...(external && tradeUrl.trim() ? [`取引ページ：${tradeUrl.trim()}`] : []),
                  data.mode === "manual"
                    ? `種類：${TYPE_LABELS[data.type]} / 金額：${Number(data.amount).toLocaleString("ja-JP")}円 / 納期：${data.dueDate ?? "なし"}${external ? "" : ` / いまの段階：${data.status}`}`
                    : "金額と種類はあとで決めます。",
                  ...(itemPlan ? [`品目：${itemPlan.items.length}点（${itemPlan.items.map((item) => item.title).join("、")}）`] : []),
                  "お客さんにメールは送りません。",
                  `依頼文：${data.note || "なし"}`,
                ],
              );
              setError("");
            } catch {
              setError("入力に足りないところがあります。");
            }
          }}
        >
          <fieldset
            disabled={!operation.ready || operation.busy}
            className="space-y-3"
          >
            <label className="block text-sm">
              登録のしかた
              <select
                className={ui.input}
                value={form.mode}
                onChange={(e) =>
                  setForm((v) => ({ ...v, mode: e.target.value }))
                }
              >
                <option value="external">サイトの外で受けた依頼（つなぐ・SNS・メールなど）</option>
                <option value="manual">決まっている案件</option>
              </select>
            </label>
            {(
              [
                ["title", "案件名"],
                ["clientName", "お客さんの名前"],
                ["clientEmail", "お客さんのメール"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                {label}
                <input
                  className={ui.input}
                  type={key === "clientEmail" ? "email" : "text"}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
            {form.mode === "external" ? (
              <>
                <label className="block text-sm">
                  受けた場所
                  <select className={ui.input} value={form.place} onChange={(e) => setForm((v) => ({ ...v, place: e.target.value }))}>
                    {PLACES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="block text-sm">
                  取引ページのURL（あれば）
                  <input className={ui.input} type="url" inputMode="url" value={form.tradeUrl} onChange={(e) => setForm((v) => ({ ...v, tradeUrl: e.target.value }))} />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={form.externalMulti === "1"}
                    onChange={(e) => setForm((v) => ({
                      ...v,
                      externalMulti: e.target.checked ? "1" : "",
                      externalItems: e.target.checked && !v.externalItems ? JSON.stringify(emptyRegistrationItems()) : v.externalItems,
                    }))}
                  />
                  1つの依頼で2点以上ある
                </label>
                {form.externalMulti === "1" ? (
                  <RegistrationItemRows
                    rows={readCaseItemDraft(form.externalItems)}
                    onChange={(rows) => setForm((v) => ({ ...v, externalItems: JSON.stringify(rows) }))}
                  />
                ) : (
                <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-3">
                  <legend className="px-1 text-sm">決まっていれば（あとでも入れられます）</legend>
                  <label className="block text-sm">
                    依頼の種類
                    <select className={ui.input} value={form.externalType} onChange={(e) => setForm((v) => ({ ...v, externalType: e.target.value }))}>
                      <option value="">まだ</option>
                      {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm">
                    金額（円）
                    <input type="number" min={0} className={ui.input} value={form.externalAmount} onChange={(e) => setForm((v) => ({ ...v, externalAmount: e.target.value }))} />
                  </label>
                  <label className="block text-sm">
                    納期
                    <input type="date" className={ui.input} value={form.externalDue} onChange={(e) => setForm((v) => ({ ...v, externalDue: e.target.value }))} />
                  </label>
                </fieldset>
                )}
              </>
            ) : null}
            {form.mode === "manual" ? (
              <>
                <label className="block text-sm">
                  依頼の種類
                  <select
                    className={ui.input}
                    value={form.type}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, type: e.target.value }))
                    }
                  >
                    {[
                      ["icon", "アイコン"],
                      ["sd", "SD"],
                      ["standing", "立ち絵"],
                      ["illustration", "イラスト"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  金額（円）
                  <input
                    type="number"
                    min={0}
                    className={ui.input}
                    value={form.amount}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, amount: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  いまの段階
                  <select
                    className={ui.input}
                    value={form.status}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, status: e.target.value }))
                    }
                  >
                    <option value="inquiry">相談受付</option>
                    <option value="estimating">見積を作っている</option>
                    <option value="quoted">見積を出した</option>
                    <option value="awaiting_payment">
                      入金待ち
                    </option>
                  </select>
                </label>
                <label className="block text-sm">
                  納期のプラン
                  <select
                    className={ui.input}
                    value={form.deliveryPlan}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, deliveryPlan: e.target.value }))
                    }
                  >
                    <option value="normal">通常</option>
                    <option value="rush_14_days">14日</option>
                    <option value="rush_7_days">7日</option>
                  </select>
                </label>
                <label className="block text-sm">
                  作業を始める日
                  <input
                    type="date"
                    className={ui.input}
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, startDate: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  納期
                  <input
                    type="date"
                    className={ui.input}
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, dueDate: e.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}
            <label className="block text-sm">
              依頼文（お客さんから届いた文章を貼れます）
              <textarea
                className={`${ui.input} min-h-32`}
                value={form.note}
                onChange={(e) =>
                  setForm((v) => ({ ...v, note: e.target.value }))
                }
              />
            </label>
            <button className={ui.btnSecondary}>登録する（前に内容を表示）</button>
          </fieldset>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
function RegistrationDirty({
  dirty,
  onChange,
}: {
  dirty: boolean;
  onChange: (v: boolean) => void;
}) {
  useEffect(() => {
    onChange(dirty);
    return () => onChange(false);
  }, [dirty, onChange]);
  return null;
}
