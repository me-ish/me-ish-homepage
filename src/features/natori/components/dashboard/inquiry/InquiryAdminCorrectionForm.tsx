"use client";

// 見積もり前の管理確定項目（金額 / 納品予定日 / 納期プラン / 次のアクション）。
//
// 金額・納期・納期プランは ProjectEditForm と同じ
// UpdateNatoriProjectDetailsInput / normalizeNatoriProjectDetailsPatch 契約を
// 使い、フォームを増やしても保存契約が二重化しないようにする。
// 案件種別は InquiryTypeConfirmation の責務なのでここでは扱わない。
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { useState } from "react";
import { useRevisionedEdit } from "../useRevisionedEdit";
import EditConflictReview from "../EditConflictReview";
import { projectEditSnapshot, projectEditValues, type ProjectEditSnapshot } from "../../../lib/editConflict";
import {
  NATORI_DELIVERY_PLANS,
  NATORI_DELIVERY_PLAN_ORDER,
} from "@/features/natori/lib/deliveryPlans";
import {
  fetchNatoriProject,
  NatoriProjectDetailsValidationError,
  normalizeNatoriProjectDetailsPatch,
  type UpdateNatoriProjectDetailsInput,
} from "@/features/natori/data/supabaseProjects";
import {
  formatNatoriProjectAmount,
} from "@/features/natori/lib/projectReadModel";
import type { NatoriDeliveryPlan, NatoriProject } from "@/features/natori/types/projects";

export type InquiryAdminCorrectionFormProps = {
  project: NatoriProject;
  disabled?: boolean;
  onSave: (patch: UpdateNatoriProjectDetailsInput, expectedRevision?: number, nextAction?: string) => Promise<ProjectEditSnapshot | void>;
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
}: InquiryAdminCorrectionFormProps) {
  const correctionValues = (snapshot: ProjectEditSnapshot) => {
    const values = projectEditValues(snapshot);
    return { amount: values.amount, dueDate: values.dueDate, deliveryPlan: values.deliveryPlan, nextAction: values.nextAction };
  };
  const session = useRevisionedEdit({ revision: project.mutationRevision, values: correctionValues(projectEditSnapshot(project)) });
  const { amount, dueDate, deliveryPlan, nextAction } = session.values;
  const { saving, error } = session;
  const [saved, setSaved] = useState(false);
  const handleSave = async () => {
    if (disabled || saving) return;
    setSaved(false);
    const parsedAmount = parseAmountInput(amount);
    if (parsedAmount === "invalid") { session.setError("金額は0以上の整数で入力してください（未確定は空欄）。"); return; }
    const patch: UpdateNatoriProjectDetailsInput = {};
    if (amount !== session.base.values.amount) patch.amount = parsedAmount;
    if (dueDate !== session.base.values.dueDate) patch.dueDate = dueDate || null;
    if (deliveryPlan !== session.base.values.deliveryPlan) patch.deliveryPlan = deliveryPlan;
    try { normalizeNatoriProjectDetailsPatch(patch); }
    catch (err) { session.setError(err instanceof NatoriProjectDetailsValidationError ? err.message : String(err)); return; }
    const success = await session.save(async (_changes, revision) => {
      const result = await onSave(patch, typeof revision === "number" ? revision : undefined,
        nextAction !== session.base.values.nextAction ? nextAction.trim() : undefined);
      if (result) return { revision: result.mutationRevision, values: correctionValues(result) };
    });
    if (success) setSaved(true);
  };

  return (
    <section aria-labelledby="inquiry-correction-heading">
      <h3
        id="inquiry-correction-heading"
        className="mb-2 text-xs font-bold text-zinc-600"
      >
        管理確定項目
      </h3>
      <div className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="inquiry-amount"
              className="mb-1 block text-xs font-bold text-zinc-600"
            >
              金額（円）
            </label>
            <input
              id="inquiry-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => session.setField("amount", event.target.value)}
              disabled={disabled || saving || session.reading}
              placeholder="未確定は空欄"
              className={natoriAdminUi.input}
              aria-describedby="inquiry-amount-hint"
            />
            <p id="inquiry-amount-hint" className="mt-1 text-xs text-zinc-500">
              現在: {formatNatoriProjectAmount(project.amount)}／空欄=未確定、0=無料
            </p>
          </div>
          <div>
            <label
              htmlFor="inquiry-due-date"
              className="mb-1 block text-xs font-bold text-zinc-600"
            >
              納品予定日
            </label>
            <input
              id="inquiry-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => session.setField("dueDate", event.target.value)}
              disabled={disabled || saving || session.reading}
              className={natoriAdminUi.input}
              aria-describedby="inquiry-due-date-hint"
            />
            <p id="inquiry-due-date-hint" className="mt-1 text-xs text-zinc-500">
              空欄のままなら未確定として扱います。
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="inquiry-delivery-plan"
              className="mb-1 block text-xs font-bold text-zinc-600"
            >
              納期プラン
            </label>
            <select
              id="inquiry-delivery-plan"
              value={deliveryPlan}
              onChange={(event) =>
                session.setField("deliveryPlan", event.target.value as NatoriDeliveryPlan)
              }
              disabled={disabled || saving || session.reading}
              className={natoriAdminUi.input}
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
              className="mb-1 block text-xs font-bold text-zinc-600"
            >
              次のアクション
            </label>
            <input
              id="inquiry-next-action"
              value={nextAction}
              onChange={(event) => session.setField("nextAction", event.target.value)}
              disabled={disabled || saving || session.reading}
              maxLength={120}
              className={natoriAdminUi.input}
            />
          </div>
        </div>

        {session.needsReview ? <EditConflictReview initial={session.initial.values} latest={session.latest?.values ?? null} current={session.values}
          labels={{ amount: "金額", dueDate: "納品予定日", deliveryPlan: "納期プラン", nextAction: "次のアクション" }} reading={session.reading}
          onCompare={() => void session.compare(async () => { const latest = await fetchNatoriProject(project.id); if (!latest || !Number.isSafeInteger(latest.mutationRevision)) throw new Error("unavailable"); return { revision: latest.mutationRevision, values: correctionValues(projectEditSnapshot(latest)) }; })} onAcknowledge={session.acknowledge} /> : null}
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
          disabled={disabled || saving || session.reading || session.needsReview}
          aria-busy={saving}
          className={natoriAdminUi.btnPrimary}
        >
          {saving ? "保存中…" : "確定内容を保存"}
        </button>
      </div>
    </section>
  );
}
