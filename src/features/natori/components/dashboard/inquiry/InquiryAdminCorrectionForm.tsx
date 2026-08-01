"use client";

// 見積もり前の管理確定項目（金額 / 納品予定日 / 納期プラン / 次のアクション）。
//
// 金額・納期・納期プランは ProjectEditForm と同じ
// UpdateNatoriProjectDetailsInput / normalizeNatoriProjectDetailsPatch 契約を
// 使い、フォームを増やしても保存契約が二重化しないようにする。
// 案件種別は InquiryTypeConfirmation の責務なのでここでは扱わない。
import { useEffect, useState } from "react";
import {
  DEFAULT_NATORI_DELIVERY_PLAN,
  NATORI_DELIVERY_PLANS,
  NATORI_DELIVERY_PLAN_ORDER,
} from "@/features/natori/lib/deliveryPlans";
import {
  NatoriProjectDetailsValidationError,
  normalizeNatoriProjectDetailsPatch,
  type UpdateNatoriProjectDetailsInput,
} from "@/features/natori/data/supabaseProjects";
import {
  formatNatoriProjectAmount,
  toNatoriAmountInputValue,
  toNatoriDueDateInputValue,
} from "@/features/natori/lib/projectReadModel";
import type { NatoriDeliveryPlan, NatoriProject } from "@/features/natori/types/projects";

export type InquiryAdminCorrectionFormProps = {
  project: NatoriProject;
  disabled?: boolean;
  onSave: (patch: UpdateNatoriProjectDetailsInput) => Promise<void>;
  onSaveNextAction: (nextAction: string) => Promise<void>;
};

/** 空欄は「未確定」。0 は「無料」として区別する。 */
function parseAmountInput(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/u.test(trimmed)) return "invalid";
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : "invalid";
}

export default function InquiryAdminCorrectionForm({
  project,
  disabled,
  onSave,
  onSaveNextAction,
}: InquiryAdminCorrectionFormProps) {
  const [amount, setAmount] = useState(toNatoriAmountInputValue(project.amount));
  const [dueDate, setDueDate] = useState(toNatoriDueDateInputValue(project.dueDate));
  const [deliveryPlan, setDeliveryPlan] = useState<NatoriDeliveryPlan>(
    project.deliveryPlan ?? DEFAULT_NATORI_DELIVERY_PLAN
  );
  const [nextAction, setNextAction] = useState(project.nextAction ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAmount(toNatoriAmountInputValue(project.amount));
    setDueDate(toNatoriDueDateInputValue(project.dueDate));
    setDeliveryPlan(project.deliveryPlan ?? DEFAULT_NATORI_DELIVERY_PLAN);
    setNextAction(project.nextAction ?? "");
    setError(null);
  }, [
    project.id,
    project.amount,
    project.dueDate,
    project.deliveryPlan,
    project.nextAction,
  ]);

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    setSaved(false);

    const parsedAmount = parseAmountInput(amount);
    if (parsedAmount === "invalid") {
      setError("金額は0以上の整数で入力してください（未確定は空欄）。");
      return;
    }

    const patch: UpdateNatoriProjectDetailsInput = {
      amount: parsedAmount,
      dueDate: dueDate.trim() === "" ? null : dueDate,
      deliveryPlan,
    };
    try {
      normalizeNatoriProjectDetailsPatch(patch);
    } catch (err) {
      if (err instanceof NatoriProjectDetailsValidationError) {
        setError(err.message);
        return;
      }
      throw err;
    }

    setSaving(true);
    try {
      await onSave(patch);
      if (nextAction.trim() !== (project.nextAction ?? "").trim()) {
        await onSaveNextAction(nextAction.trim());
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="inquiry-correction-heading">
      <h3
        id="inquiry-correction-heading"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700"
      >
        管理確定項目
      </h3>
      <div className="space-y-3 rounded-xl border border-pink-100 bg-white p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="inquiry-amount"
              className="mb-1 block text-xs font-bold text-gray-600"
            >
              金額（円）
            </label>
            <input
              id="inquiry-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={disabled || saving}
              placeholder="未確定は空欄"
              className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm"
              aria-describedby="inquiry-amount-hint"
            />
            <p id="inquiry-amount-hint" className="mt-1 text-[11px] text-gray-500">
              現在: {formatNatoriProjectAmount(project.amount)}／空欄=未確定、0=無料
            </p>
          </div>
          <div>
            <label
              htmlFor="inquiry-due-date"
              className="mb-1 block text-xs font-bold text-gray-600"
            >
              納品予定日
            </label>
            <input
              id="inquiry-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={disabled || saving}
              className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm"
              aria-describedby="inquiry-due-date-hint"
            />
            <p id="inquiry-due-date-hint" className="mt-1 text-[11px] text-gray-500">
              空欄のままなら未確定として扱います。
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="inquiry-delivery-plan"
              className="mb-1 block text-xs font-bold text-gray-600"
            >
              納期プラン
            </label>
            <select
              id="inquiry-delivery-plan"
              value={deliveryPlan}
              onChange={(event) =>
                setDeliveryPlan(event.target.value as NatoriDeliveryPlan)
              }
              disabled={disabled || saving}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm"
            >
              {NATORI_DELIVERY_PLAN_ORDER.map((id) => (
                <option key={id} value={id}>
                  {NATORI_DELIVERY_PLANS[id].label}（{NATORI_DELIVERY_PLANS[id].description}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="inquiry-next-action"
              className="mb-1 block text-xs font-bold text-gray-600"
            >
              次のアクション
            </label>
            <input
              id="inquiry-next-action"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              disabled={disabled || saving}
              maxLength={120}
              className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-xs font-bold text-rose-700">
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p role="status" className="text-xs font-bold text-emerald-700">
            保存しました。
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving}
          aria-busy={saving}
          className="inline-flex h-9 items-center rounded-full bg-pink-500 px-4 text-xs font-bold text-white shadow-sm hover:bg-pink-600 disabled:opacity-60"
        >
          {saving ? "保存中…" : "確定内容を保存"}
        </button>
      </div>
    </section>
  );
}
