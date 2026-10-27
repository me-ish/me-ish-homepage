"use client";
import { useEffect, useState } from "react";
import { useCaseDraft } from "./useCaseDraft";
import { useCaseAdminOperation } from "./useCaseAdminOperation";
import { CaseAdminConfirmation } from "./CaseAdministrationPanel";
import { caseRegistration } from "../../lib/caseAdministration";
import { calculateDueDate } from "../../lib/deliveryPlans";
import { natoriAdminUi as ui } from "../../constants/adminUi";
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
    },
    setFormDirty,
  );
  // Both the tab draft and frozen command participate in the workspace leaving guard.
  // Callback identities are stable state setters supplied by the workspace.
  const dirty = opDirty || formDirty;
  return (
    <section
      aria-label="新しい案件の登録"
      className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-3"
    >
      <RegistrationDirty dirty={dirty} onChange={onDraftChange} />
      <button
        className={ui.btnSecondary}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        案件を登録
      </button>
      <CaseAdminConfirmation operation={operation} />
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
            });
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
              const data = caseRegistration.parse({
                ...form,
                amount: Number(form.amount),
              });
              operation.prepare(
                {
                  operationId: crypto.randomUUID(),
                  projectId: null,
                  revision: null,
                  action: { command: "create", data },
                },
                [
                  `登録のしかた：${data.mode === "external" ? "サイトの外で受けた相談（金額や納期はあとで決める）" : "決まっている案件を登録"}`,
                  `案件：${data.title} / お客さん：${data.clientName}`,
                  `メール：${data.clientEmail || "なし"}`,
                  data.mode === "manual"
                    ? `種類：${data.type} / 金額：${Number(data.amount).toLocaleString("ja-JP")}円 / 納期：${data.dueDate} / いまの段階：${data.status}`
                    : "案件だけを登録します。お客さんにメールは送りません。",
                  `メモ：${data.note}`,
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
                <option value="external">サイトの外で受けた相談</option>
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
              メモ
              <textarea
                className={ui.input}
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
