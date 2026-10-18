"use client";

import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { useRevisionedEdit } from "./useRevisionedEdit";
import EditConflictReview from "./EditConflictReview";
import { dirtyFields, projectEditSnapshot, projectEditValues, PROJECT_EDIT_LABELS, type ProjectEditSnapshot } from "../../lib/editConflict";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import {
  NATORI_CONCRETE_PROJECT_TYPES,
  NATORI_PROJECT_TYPE_LABELS,
} from "@/features/natori/lib/projectReadModel";
import type {
  NatoriProject,
  NatoriProjectType,
} from "@/features/natori/types/projects";

export type ProjectEditFormProps = {
  project: NatoriProject;
  onCancel: () => void;
  onSave: (patch: UpdateNatoriProjectDetailsInput, expectedRevision?: number) => Promise<ProjectEditSnapshot | void>;
};

export default function ProjectEditForm({
  project,
  onCancel,
  onSave,
}: ProjectEditFormProps) {
  const session = useRevisionedEdit({ revision: project.mutationRevision, values: projectEditValues(projectEditSnapshot(project)) });
  const { clientName, title, type, amount, deliveryPlan, startDate, dueDate, note } = session.values;
  const { saving, error } = session;
  const handleSave = async () => {
    const input: UpdateNatoriProjectDetailsInput = {};
    const changes = dirtyFields(session.base.values, session.values);
    if (changes.clientName !== undefined) input.clientName = changes.clientName;
    if (changes.title !== undefined) input.title = changes.title;
    if (changes.type !== undefined) input.type = changes.type as UpdateNatoriProjectDetailsInput["type"];
    if (changes.amount !== undefined) input.amount = changes.amount.trim() === "" ? null : Number(changes.amount);
    if (changes.deliveryPlan !== undefined) input.deliveryPlan = changes.deliveryPlan;
    if (changes.startDate !== undefined) input.startDate = changes.startDate || null;
    if (changes.dueDate !== undefined) input.dueDate = changes.dueDate || null;
    if (changes.note !== undefined) input.note = changes.note;
    try { normalizeNatoriProjectDetailsPatch(input); }
    catch (err) { session.setError(err instanceof NatoriProjectDetailsValidationError ? err.message : String(err)); return; }
    await session.save(async (_patch, revision) => {
      const result = await onSave(input, typeof revision === "number" ? revision : undefined);
      if (result) return { revision: result.mutationRevision, values: projectEditValues(result) };
    });
  };

  const canSave = clientName.trim().length > 0 && title.trim().length > 0 && !saving && !session.needsReview && !session.reading;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pink-50 text-[#DB2777] ring-1 ring-inset ring-pink-500/10">
          <Pencil className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900">案件情報を編集</p>
          <p className="text-xs text-zinc-600">
            ステータスは変更されません。状態の進行は案件カードのボタンから行ってください。
          </p>
        </div>
      </div>

      <fieldset disabled={saving || session.reading} className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="block text-xs font-bold text-zinc-600">
            依頼者名（必須）
          </span>
          <input
            type="text"
            value={clientName}
            onChange={(event) => session.setField("clientName", event.target.value)}
            className={`${natoriAdminUi.input} mt-1`}
          />
        </label>

        <label className="block text-sm">
          <span className="block text-xs font-bold text-zinc-600">
            案件タイトル（必須）
          </span>
          <input
            type="text"
            value={title}
            onChange={(event) => session.setField("title", event.target.value)}
            className={`${natoriAdminUi.input} mt-1`}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block text-xs font-bold text-zinc-600">
              案件タイプ
            </span>
            <select
              value={type}
              onChange={(event) => session.setField("type", event.target.value as NatoriProjectType)}
              className={`${natoriAdminUi.input} mt-1`}
            >
              {type === "undecided" ? (
                <option value="undecided" disabled>
                  {NATORI_PROJECT_TYPE_LABELS.undecided}
                </option>
              ) : null}
              {NATORI_CONCRETE_PROJECT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {NATORI_PROJECT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-bold text-zinc-600">
              金額（円）
            </span>
            <input
              type="number"
              min={0}
              value={amount}
              placeholder="未定"
              onChange={(event) => session.setField("amount", event.target.value)}
              className={`${natoriAdminUi.input} mt-1`}
            />
            {project.amount === null && !amount ? (
              <span className="mt-1 block text-xs text-zinc-500">
                金額未定のまま保存する場合、この欄は空欄にしてください。
              </span>
            ) : null}
          </label>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <p className="text-xs font-bold text-zinc-600">納期プラン</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {NATORI_DELIVERY_PLAN_ORDER.map((id) => {
              const meta = NATORI_DELIVERY_PLANS[id];
              const selected = id === deliveryPlan;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => session.setField("deliveryPlan", id)}
                  aria-pressed={selected}
                  className={cn(
                    "min-w-0 rounded-xl border px-3 py-2 text-left transition",
                    selected
                      ? cn(meta.chipClassName, "ring-2 ring-offset-1", meta.barAccentClassName)
                      : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300"
                  )}
                >
                  <p className="text-sm font-bold leading-5">{meta.shortLabel}</p>
                  <p className="mt-0.5 text-xs leading-4 opacity-80">{meta.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block text-xs font-bold text-zinc-600">
              開始日
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => session.setField("startDate", event.target.value)}
              className={`${natoriAdminUi.input} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-bold text-zinc-600">
              納期
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => session.setField("dueDate", event.target.value)}
              className={`${natoriAdminUi.input} mt-1`}
            />
            {project.dueDate === null && !dueDate ? (
              <span className="mt-1 block text-xs text-zinc-500">
                納期未定のまま保存する場合、この欄は空欄にしてください。
              </span>
            ) : null}
          </label>
        </div>

        <label className="block text-sm">
          <span className="block text-xs font-bold text-zinc-600">
            依頼内容・確認事項メモ
          </span>
          <Textarea
            value={note}
            onChange={(event) => session.setField("note", event.target.value)}
            placeholder="依頼文、用途、サイズ、表情差分、商用利用、希望納期、確認事項、やり取りメモ等。"
            className="mt-1 min-h-[120px] resize-y border-zinc-200 bg-white text-sm leading-6 text-zinc-900 focus-visible:ring-[#BE185D]/30"
          />
        </label>

        {session.needsReview ? <EditConflictReview initial={session.initial.values} latest={session.latest?.values ?? null} current={session.values} labels={PROJECT_EDIT_LABELS}
          reading={session.reading} onCompare={() => void session.compare(async () => { const latest = await fetchNatoriProject(project.id); if (!latest) throw new Error("not_found"); const snapshot = projectEditSnapshot(latest); if (!Number.isSafeInteger(snapshot.mutationRevision)) throw new Error("missing_revision"); return { revision: snapshot.mutationRevision, values: projectEditValues(snapshot) }; })} onAcknowledge={session.acknowledge} /> : null}
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            onClick={onCancel}
            disabled={saving}
            variant="outline"
            className="h-10 rounded-full border-zinc-200 bg-white px-4 text-xs font-bold text-[#BE185D] hover:bg-zinc-50 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={natoriAdminUi.btnPrimary}
          >
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
