"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_NATORI_DELIVERY_PLAN,
  NATORI_DELIVERY_PLANS,
  NATORI_DELIVERY_PLAN_ORDER,
} from "@/lib/natori/deliveryPlans";
import {
  NatoriProjectDetailsValidationError,
  normalizeNatoriProjectDetailsPatch,
  type UpdateNatoriProjectDetailsInput,
} from "@/lib/natori/supabaseProjects";
import { cn } from "@/lib/utils";
import type {
  NatoriDeliveryPlan,
  NatoriProject,
  NatoriProjectType,
} from "@/types/natori/projects";

const PROJECT_TYPE_LABELS: Record<NatoriProjectType, string> = {
  icon: "アイコン",
  sd: "SD",
  standing: "立ち絵",
  illustration: "イラスト",
};

export type ProjectEditFormProps = {
  project: NatoriProject;
  onCancel: () => void;
  onSave: (patch: UpdateNatoriProjectDetailsInput) => Promise<void>;
};

export default function ProjectEditForm({
  project,
  onCancel,
  onSave,
}: ProjectEditFormProps) {
  const [clientName, setClientName] = useState(project.clientName);
  const [title, setTitle] = useState(project.title);
  const [type, setType] = useState<NatoriProjectType>(project.type);
  const [amount, setAmount] = useState<number>(project.amount);
  const [deliveryPlan, setDeliveryPlan] = useState<NatoriDeliveryPlan>(
    project.deliveryPlan ?? DEFAULT_NATORI_DELIVERY_PLAN
  );
  const [startDate, setStartDate] = useState<string>(project.startDate ?? "");
  const [dueDate, setDueDate] = useState<string>(project.dueDate);
  const [note, setNote] = useState<string>(project.note ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync local form state if the upstream project changes while the form
  // is open (e.g. another tab toggled a task).
  useEffect(() => {
    setClientName(project.clientName);
    setTitle(project.title);
    setType(project.type);
    setAmount(project.amount);
    setDeliveryPlan(project.deliveryPlan ?? DEFAULT_NATORI_DELIVERY_PLAN);
    setStartDate(project.startDate ?? "");
    setDueDate(project.dueDate);
    setNote(project.note ?? "");
    setError(null);
  }, [
    project.id,
    project.clientName,
    project.title,
    project.type,
    project.amount,
    project.deliveryPlan,
    project.startDate,
    project.dueDate,
    project.note,
  ]);

  const handleSave = async () => {
    setError(null);
    const input: UpdateNatoriProjectDetailsInput = {
      clientName,
      title,
      type,
      amount,
      deliveryPlan,
      startDate: startDate ? startDate : null,
      dueDate,
      note: note,
    };
    // Validate locally first so we don't fire a request just to get a 400 back.
    try {
      normalizeNatoriProjectDetailsPatch(input);
    } catch (err) {
      if (err instanceof NatoriProjectDetailsValidationError) {
        setError(err.message);
        return;
      }
      throw err;
    }
    setSaving(true);
    try {
      await onSave(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const canSave = clientName.trim().length > 0 && title.trim().length > 0 && !saving;

  return (
    <div className="rounded-2xl border border-pink-200 bg-pink-50/60 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-pink-500 text-white">
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-pink-900">案件情報を編集</p>
          <p className="text-xs text-pink-800/80">
            ステータスは変更されません。状態の進行は案件カードのボタンから行ってください。
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
            依頼者名（必須）
          </span>
          <input
            type="text"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </label>

        <label className="block text-sm">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
            案件タイトル（必須）
          </span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
              案件タイプ
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as NatoriProjectType)}
              className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              {(Object.keys(PROJECT_TYPE_LABELS) as NatoriProjectType[]).map((value) => (
                <option key={value} value={value}>
                  {PROJECT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
              金額（円）
            </span>
            <input
              type="number"
              min={0}
              value={Number.isFinite(amount) ? amount : 0}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-right text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-pink-200 bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">納期プラン</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {NATORI_DELIVERY_PLAN_ORDER.map((id) => {
              const meta = NATORI_DELIVERY_PLANS[id];
              const selected = id === deliveryPlan;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDeliveryPlan(id)}
                  aria-pressed={selected}
                  className={cn(
                    "min-w-0 rounded-xl border px-3 py-2 text-left transition",
                    selected
                      ? cn(meta.chipClassName, "ring-2 ring-offset-1", meta.barAccentClassName)
                      : "border-pink-200 bg-white text-pink-900 hover:border-pink-300"
                  )}
                >
                  <p className="text-sm font-black leading-5">{meta.shortLabel}</p>
                  <p className="mt-0.5 text-[11px] leading-4 opacity-80">{meta.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
              開始日
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
              納期（必須）
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
            依頼内容・確認事項メモ
          </span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="依頼文、用途、サイズ、表情差分、商用利用、希望納期、確認事項、やり取りメモ等。"
            className="mt-1 min-h-[120px] resize-y border-pink-200 bg-white text-sm leading-6 text-gray-900 focus-visible:ring-pink-300"
          />
        </label>

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
            className="h-10 rounded-full border-pink-300 bg-white px-4 text-xs font-bold text-pink-700 hover:bg-pink-50 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="h-10 rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
