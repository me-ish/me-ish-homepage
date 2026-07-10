"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createNatoriProject,
  deleteNatoriProject,
  fetchNatoriProjects,
  updateNatoriProjectDetails,
  type UpdateNatoriProjectDetailsInput,
} from "@/features/natori/data/supabaseProjects";
import { toISODate } from "@/features/natori/lib/projects";
import { formatYen } from "@/features/natori/lib/pricing";
import {
  summarizeNatoriResults,
  type NatoriResultsSummary,
} from "@/features/natori/lib/results";
import ProjectEditForm from "./ProjectEditForm";
import type {
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectType,
} from "@/features/natori/types/projects";

const PROJECT_TYPE_LABELS: Record<NatoriProjectType, string> = {
  icon: "アイコン",
  sd: "SD",
  standing: "立ち絵",
  illustration: "イラスト",
};

const RESULT_STATUS_LABELS: Partial<Record<NatoriProjectStatus, string>> = {
  delivered: "納品済み",
  completed: "対応完了",
};

const RESULT_STATUS_OPTIONS: Array<{ value: NatoriProjectStatus; label: string }> = [
  { value: "completed", label: "対応完了" },
  { value: "delivered", label: "納品済み" },
];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${year}/${month}/${day}`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">{label}</p>
      <p className="mt-1 text-xl font-black text-gray-900 sm:text-2xl">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

function MeterRow({
  label,
  count,
  amount,
  maxAmount,
}: {
  label: string;
  count: number;
  amount: number;
  maxAmount: number;
}) {
  const ratio = maxAmount > 0 ? amount / maxAmount : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-bold text-gray-900 sm:text-sm">
          {label}
          <span className="ml-1.5 font-medium text-gray-500">{count}件</span>
        </p>
        <p className="shrink-0 text-xs font-bold text-gray-900 sm:text-sm">{formatYen(amount)}</p>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-pink-50">
        <div
          className="h-full rounded-full bg-pink-500"
          style={{ width: `${Math.max(ratio * 100, amount > 0 ? 2 : 0)}%` }}
          aria-hidden="true"
        />
      </div>
    </li>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      {children}
    </section>
  );
}

/**
 * 過去の実績（ツール導入前の案件など）を「対応完了 / 納品済み」の案件として
 * 手入力で登録するフォーム。完了日は納期（dueDate）として保存される。
 */
function ResultAddForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<NatoriProjectType>("illustration");
  const [status, setStatus] = useState<NatoriProjectStatus>("completed");
  const [amount, setAmount] = useState<number>(0);
  const [dateISO, setDateISO] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  useEffect(() => {
    setDateISO(toISODate(new Date()));
  }, []);

  const canSubmit =
    clientName.trim().length > 0 && title.trim().length > 0 && dateISO.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSavedTitle(null);
    try {
      await createNatoriProject({
        title: title.trim(),
        clientName: clientName.trim(),
        amount: Math.max(0, Number.isFinite(amount) ? Math.round(amount) : 0),
        type,
        status,
        startDateISO: dateISO,
        dueDateISO: dateISO,
        nextAction: "",
        note: note.trim() ? note.trim() : undefined,
      });
      await onAdded();
      setSavedTitle(title.trim());
      setClientName("");
      setTitle("");
      setAmount(0);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-pink-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left hover:bg-pink-50/40 sm:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-pink-500 text-white">
            <Plus className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">実績を手入力で追加</p>
            <p className="mt-0.5 text-xs text-gray-600">
              ツール導入前の過去案件などを、完了済みの実績として登録できます。
            </p>
          </div>
        </div>
        <span className="shrink-0 text-gray-500">
          {open ? <ChevronUp className="h-5 w-5" aria-hidden /> : <ChevronDown className="h-5 w-5" aria-hidden />}
        </span>
      </button>

      {open ? (
        <div className="border-t border-pink-100 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
                依頼者名（必須）
              </span>
              <input
                type="text"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="例: 〇〇様"
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
                placeholder="例: 立ち絵一式"
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
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
                ステータス
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as NatoriProjectStatus)}
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              >
                {RESULT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
            <label className="block text-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
                完了日（必須）
              </span>
              <input
                type="date"
                value={dateISO}
                onChange={(event) => setDateISO(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
              メモ（任意）
            </span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="依頼内容や納品物のメモなど。"
              className="mt-1 min-h-[80px] resize-y border-pink-200 bg-white text-sm leading-6 text-gray-900 focus-visible:ring-pink-300"
            />
          </label>

          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {error}
            </p>
          ) : null}
          {savedTitle ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              「{savedTitle}」を実績に追加しました。
            </p>
          ) : null}

          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-10 rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60"
            >
              {submitting ? "追加中…" : "実績に追加"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CompletedProjectRow({
  project,
  editing,
  busy,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  project: NatoriProject;
  editing: boolean;
  busy: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: UpdateNatoriProjectDetailsInput) => Promise<void>;
  onDelete: () => void;
}) {
  if (editing) {
    return (
      <li>
        <ProjectEditForm project={project} onCancel={onCancelEdit} onSave={onSaveEdit} />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 rounded-xl border border-pink-100 bg-pink-50/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 break-words text-sm font-bold text-gray-900">{project.title}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <p className="text-sm font-bold text-gray-900">{formatYen(project.amount)}</p>
          <button
            type="button"
            onClick={onBeginEdit}
            disabled={busy}
            className="grid h-7 w-7 place-items-center rounded-full border border-pink-200 bg-white text-pink-700 hover:bg-pink-50 disabled:opacity-50"
            aria-label={`「${project.title}」を編集`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="grid h-7 w-7 place-items-center rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
            aria-label={`「${project.title}」を削除`}
          >
            {busy ? <X className="h-3.5 w-3.5" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
        <span>{project.clientName}</span>
        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-pink-700">
          {PROJECT_TYPE_LABELS[project.type]}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-emerald-700">
          {RESULT_STATUS_LABELS[project.status] ?? project.status}
        </span>
        <span className="ml-auto">納期 {formatDate(project.dueDate)}</span>
      </div>
    </li>
  );
}

export default function ResultsBoard() {
  const [projects, setProjects] = useState<NatoriProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await fetchNatoriProjects();
    setProjects(data);
  }, []);

  useEffect(() => {
    setNow(new Date());
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (err) {
        console.error("[ResultsBoard] load failed", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const summary = useMemo<NatoriResultsSummary | null>(
    () => (projects && now ? summarizeNatoriResults(projects, now) : null),
    [projects, now]
  );

  const handleSaveEdit = async (projectId: string, patch: UpdateNatoriProjectDetailsInput) => {
    await updateNatoriProjectDetails(projectId, patch);
    await reload();
    setEditingId(null);
  };

  const handleDelete = async (project: NatoriProject) => {
    const confirmed = window.confirm(
      `「${project.title}」（${project.clientName} / ${formatYen(project.amount)}）を実績から削除します。案件データごと削除され、元に戻せません。よろしいですか？`
    );
    if (!confirmed) return;
    setDeletingId(project.id);
    setListError(null);
    try {
      await deleteNatoriProject(project.id);
      await reload();
    } catch (err) {
      console.error("[ResultsBoard] delete failed", err);
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
        実績データの読み込みに失敗しました。合言葉付きのブックマークから開き直すか、時間をおいて再読み込みしてください。
        <p className="mt-1 text-[11px] opacity-80">{error}</p>
      </div>
    );
  }

  if (!summary || !now) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-pink-50/60" />
        <div className="h-48 animate-pulse rounded-2xl bg-pink-50/60" />
        <div className="h-64 animate-pulse rounded-2xl bg-pink-50/60" />
      </div>
    );
  }

  if (summary.totalCount === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-pink-100 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-pink-50 text-pink-500">
            <Trophy className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold text-gray-900">まだ実績がありません</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            案件のステータスが「納品済み」または「対応完了」になると、ここに件数や売上が表示されます。過去の案件は下のフォームから手入力でも追加できます。
          </p>
        </div>
        <ResultAddForm onAdded={reload} />
      </div>
    );
  }

  const maxMonthlyAmount = Math.max(...summary.monthly.map((month) => month.amount));
  const maxTypeAmount = Math.max(...summary.byType.map((entry) => entry.amount));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="実績件数" value={`${summary.totalCount}件`} />
        <StatTile label="総売上" value={formatYen(summary.totalAmount)} />
        <StatTile
          label={`今年（${now.getFullYear()}年）`}
          value={formatYen(summary.thisYearAmount)}
          sub={`${summary.thisYearCount}件`}
        />
        <StatTile label="平均単価" value={formatYen(summary.averageAmount)} />
      </div>

      <ResultAddForm onAdded={reload} />

      <SectionCard title="月別の実績" description="納期の月ごとの件数と売上です。">
        <ul className="mt-3 space-y-3">
          {summary.monthly.map((month) => (
            <MeterRow
              key={month.ym}
              label={month.label}
              count={month.count}
              amount={month.amount}
              maxAmount={maxMonthlyAmount}
            />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="タイプ別の実績">
        <ul className="mt-3 space-y-3">
          {summary.byType.map((entry) => (
            <MeterRow
              key={entry.type}
              label={PROJECT_TYPE_LABELS[entry.type]}
              count={entry.count}
              amount={entry.amount}
              maxAmount={maxTypeAmount}
            />
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="実績一覧"
        description="納品済み・対応完了の案件を納期の新しい順に表示しています。鉛筆で修正、ゴミ箱で削除できます。"
      >
        {listError ? (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {listError}
          </p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {summary.completed.map((project) => (
            <CompletedProjectRow
              key={project.id}
              project={project}
              editing={editingId === project.id}
              busy={deletingId === project.id}
              onBeginEdit={() => setEditingId(project.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(patch) => handleSaveEdit(project.id, patch)}
              onDelete={() => handleDelete(project)}
            />
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
