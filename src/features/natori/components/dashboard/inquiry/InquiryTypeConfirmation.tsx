"use client";

// 案件種別の確定と制作タスク生成。
// 確定は natori_confirm_project_type_v1 RPC が担い、application からは
// task を INSERT しない。通常の project 更新とは経路を分ける。
import { useState } from "react";
import { CheckCircle2, ListChecks } from "lucide-react";
import {
  NATORI_CONCRETE_PROJECT_TYPES,
  NATORI_PROJECT_TYPE_LABELS,
} from "@/features/natori/lib/projectReadModel";
import type {
  NatoriConcreteProjectType,
  NatoriProjectType,
} from "@/features/natori/types/projects";

export type InquiryTypeConfirmationProps = {
  projectType: NatoriProjectType;
  taskCount: number;
  disabled?: boolean;
  onConfirm: (projectType: NatoriConcreteProjectType) => Promise<void>;
};

export default function InquiryTypeConfirmation({
  projectType,
  taskCount,
  disabled,
  onConfirm,
}: InquiryTypeConfirmationProps) {
  const [selected, setSelected] = useState<NatoriConcreteProjectType>("icon");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = projectType !== "undecided";

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "確定できませんでした。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="inquiry-type-heading">
      <h3
        id="inquiry-type-heading"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700"
      >
        案件種別・制作タスク
      </h3>

      {confirmed ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            確定済み: {NATORI_PROJECT_TYPE_LABELS[projectType]}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-800">
            <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
            制作タスク {taskCount} 件を作成済み
          </p>
          <p className="mt-2 text-xs leading-5 text-gray-700">
            種別の変更は既存タスクの作り直しを伴うため、この画面からは行えません。
            変更が必要な場合は案件ボードで個別に対応してください。
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-pink-100 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs leading-5 text-gray-700">
            種別を確定すると、制作タスクが自動で作成されます。確定後の変更はできません。
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label
                htmlFor="inquiry-type-select"
                className="mb-1 block text-xs font-bold text-gray-600"
              >
                案件種別
              </label>
              <select
                id="inquiry-type-select"
                value={selected}
                onChange={(event) =>
                  setSelected(event.target.value as NatoriConcreteProjectType)
                }
                disabled={disabled || saving}
                className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm"
              >
                {NATORI_CONCRETE_PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {NATORI_PROJECT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={disabled || saving}
              aria-busy={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pink-500 px-4 text-xs font-bold text-white shadow-sm hover:bg-pink-600 disabled:opacity-60"
            >
              {saving ? "確定中…" : "案件種別を確定する"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-xs font-bold text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
