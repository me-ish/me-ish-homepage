"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createNatoriProject,
  deleteNatoriProject,
  fetchNatoriProjects,
  fetchNatoriProjectThumbs,
  updateNatoriProjectDetails,
  uploadNatoriProjectThumb,
  type UpdateNatoriProjectDetailsInput,
} from "@/features/natori/data/supabaseProjects";
import { toISODate } from "@/features/natori/lib/projects";
import { formatYen } from "@/features/natori/lib/pricing";
import {
  filterProjectsByYear,
  listNatoriResultYears,
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

type ResultMetric = "amount" | "count";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${year}/${month}/${day}`;
}

function formatMetric(metric: ResultMetric, count: number, amount: number): string {
  return metric === "amount" ? formatYen(amount) : `${count}件`;
}

/* ---------------- 集計タイル ---------------- */

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-gray-900 sm:text-2xl">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

/* ---------------- 月別・タイプ別のメーター行 ---------------- */

function MeterRow({
  label,
  count,
  amount,
  metric,
  maxValue,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  amount: number;
  metric: ResultMetric;
  maxValue: number;
  selected: boolean;
  onClick: () => void;
}) {
  const value = metric === "amount" ? amount : count;
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const primary = formatMetric(metric, count, amount);
  const secondary = metric === "amount" ? `${count}件` : formatYen(amount);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`w-full rounded-xl px-2 py-1.5 text-left transition ${
          selected ? "bg-pink-50 ring-2 ring-pink-300" : "hover:bg-pink-50/50"
        }`}
        title={selected ? "絞り込みを解除" : "この行で実績一覧を絞り込む"}
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-bold text-gray-900 sm:text-sm">
            {label}
            <span className="ml-1.5 font-medium text-gray-500">{secondary}</span>
          </p>
          <p className="shrink-0 text-xs font-bold text-gray-900 sm:text-sm">{primary}</p>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-pink-50">
          <div
            className="h-full rounded-full bg-pink-500"
            style={{ width: `${Math.max(ratio * 100, value > 0 ? 2 : 0)}%` }}
            aria-hidden="true"
          />
        </div>
      </button>
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

/* ---------------- 手入力追加フォーム ---------------- */

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
              「{savedTitle}」を実績に追加しました。一覧の画像ボタンからサムネイルも登録できます。
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

/* ---------------- 実績一覧の行 ---------------- */

function CompletedProjectRow({
  project,
  thumbUrl,
  editing,
  busy,
  uploading,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onPickImage,
  onPreview,
}: {
  project: NatoriProject;
  thumbUrl?: string;
  editing: boolean;
  busy: boolean;
  uploading: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: UpdateNatoriProjectDetailsInput) => Promise<void>;
  onDelete: () => void;
  onPickImage: () => void;
  onPreview: () => void;
}) {
  if (editing) {
    return (
      <li>
        <ProjectEditForm project={project} onCancel={onCancelEdit} onSave={onSaveEdit} />
      </li>
    );
  }

  return (
    <li className="flex gap-3 rounded-xl border border-pink-100 bg-pink-50/40 px-3 py-2.5">
      {/* サムネイル。画像があれば拡大、無ければアップロード */}
      <button
        type="button"
        onClick={thumbUrl ? onPreview : onPickImage}
        disabled={uploading}
        className="relative h-16 w-16 shrink-0 self-center overflow-hidden rounded-lg border border-pink-200 bg-white disabled:opacity-60"
        aria-label={thumbUrl ? `「${project.title}」の画像を拡大` : `「${project.title}」の画像を登録`}
        title={thumbUrl ? "クリックで拡大" : "クリックで作品画像を登録"}
      >
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={project.title}
            fill
            sizes="64px"
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-pink-300">
            <ImagePlus className="h-6 w-6" aria-hidden />
          </span>
        )}
        {uploading ? (
          <span className="absolute inset-0 grid place-items-center bg-white/70 text-[10px] font-bold text-pink-700">
            送信中
          </span>
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-sm font-bold text-gray-900">{project.title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <p className="text-sm font-bold text-gray-900">{formatYen(project.amount)}</p>
            <button
              type="button"
              onClick={onPickImage}
              disabled={busy || uploading}
              className="grid h-7 w-7 place-items-center rounded-full border border-pink-200 bg-white text-pink-700 hover:bg-pink-50 disabled:opacity-50"
              aria-label={`「${project.title}」の画像を${thumbUrl ? "差し替え" : "登録"}`}
              title={thumbUrl ? "画像を差し替え" : "画像を登録"}
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            </button>
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
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
          <span>{project.clientName}</span>
          <span className="rounded-full bg-white px-2 py-0.5 font-bold text-pink-700">
            {PROJECT_TYPE_LABELS[project.type]}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 font-bold text-emerald-700">
            {RESULT_STATUS_LABELS[project.status] ?? project.status}
          </span>
          <span className="ml-auto">納期 {formatDate(project.dueDate)}</span>
        </div>
        {project.note ? (
          <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-gray-500">
            {project.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/* ---------------- 本体 ---------------- */

export default function ResultsBoard() {
  const [projects, setProjects] = useState<NatoriProject[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 絞り込み・表示指標
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<NatoriProjectType | null>(null);
  const [metric, setMetric] = useState<ResultMetric>("amount");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const [data, thumbMap] = await Promise.all([
      fetchNatoriProjects(),
      fetchNatoriProjectThumbs().catch((err) => {
        console.error("[ResultsBoard] thumbs load failed", err);
        return {} as Record<string, string>;
      }),
    ]);
    setProjects(data);
    setThumbs(thumbMap);
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

  const years = useMemo(() => (projects ? listNatoriResultYears(projects) : []), [projects]);

  const summary = useMemo<NatoriResultsSummary | null>(
    () =>
      projects && now
        ? summarizeNatoriResults(filterProjectsByYear(projects, yearFilter), now)
        : null,
    [projects, now, yearFilter]
  );

  const listItems = useMemo(() => {
    if (!summary) return [];
    return summary.completed.filter(
      (project) =>
        (monthFilter === null || project.dueDate.startsWith(monthFilter)) &&
        (typeFilter === null || project.type === typeFilter)
    );
  }, [summary, monthFilter, typeFilter]);

  const handleSelectYear = (year: number | null) => {
    setYearFilter(year);
    setMonthFilter(null);
  };

  const handleSaveEdit = async (projectId: string, patch: UpdateNatoriProjectDetailsInput) => {
    await updateNatoriProjectDetails(projectId, patch);
    await reload();
    setEditingId(null);
  };

  const handleDelete = async (project: NatoriProject) => {
    const confirmed = window.confirm(
      `「${project.title}」（${project.clientName} / ${formatYen(project.amount)}）を実績から削除します。案件データ・画像ごと削除され、元に戻せません。よろしいですか？`
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

  const handlePickImage = (projectId: string) => {
    uploadTargetRef.current = projectId;
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (file: File | null) => {
    const projectId = uploadTargetRef.current;
    uploadTargetRef.current = null;
    if (!file || !projectId) return;
    setUploadingId(projectId);
    setListError(null);
    try {
      const url = await uploadNatoriProjectThumb(projectId, file);
      setThumbs((current) => ({ ...current, [projectId]: url }));
    } catch (err) {
      console.error("[ResultsBoard] thumb upload failed", err);
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingId(null);
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

  if (summary.totalCount === 0 && yearFilter === null) {
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

  const maxMonthlyValue = Math.max(
    0,
    ...summary.monthly.map((month) => (metric === "amount" ? month.amount : month.count))
  );
  const maxTypeValue = Math.max(
    0,
    ...summary.byType.map((entry) => (metric === "amount" ? entry.amount : entry.count))
  );
  const monthsInScope = Math.max(1, summary.monthly.length);
  const scopeLabel = yearFilter === null ? "全期間" : `${yearFilter}年`;
  const activeFilterChips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (yearFilter !== null) {
    activeFilterChips.push({
      key: "year",
      label: `${yearFilter}年`,
      onClear: () => handleSelectYear(null),
    });
  }
  if (monthFilter !== null) {
    const monthEntry = summary.monthly.find((month) => month.ym === monthFilter);
    activeFilterChips.push({
      key: "month",
      label: monthEntry?.label ?? monthFilter,
      onClear: () => setMonthFilter(null),
    });
  }
  if (typeFilter !== null) {
    activeFilterChips.push({
      key: "type",
      label: PROJECT_TYPE_LABELS[typeFilter],
      onClear: () => setTypeFilter(null),
    });
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 隠しファイル入力（一覧のどの行からも共有で使う） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          void handleFileChosen(file);
        }}
      />

      {/* 期間と表示指標の切り替え */}
      <section className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-pink-700">
              期間
            </span>
            <button
              type="button"
              onClick={() => handleSelectYear(null)}
              aria-pressed={yearFilter === null}
              className={`h-8 rounded-full border px-3 text-xs font-bold transition ${
                yearFilter === null
                  ? "border-pink-500 bg-pink-500 text-white"
                  : "border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
              }`}
            >
              全期間
            </button>
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => handleSelectYear(yearFilter === year ? null : year)}
                aria-pressed={yearFilter === year}
                className={`h-8 rounded-full border px-3 text-xs font-bold transition ${
                  yearFilter === year
                    ? "border-pink-500 bg-pink-500 text-white"
                    : "border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                }`}
              >
                {year}年
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-pink-700">表示</span>
            <div className="flex rounded-full border border-pink-200 bg-white p-0.5">
              {(
                [
                  { value: "amount", label: "売上" },
                  { value: "count", label: "件数" },
                ] as Array<{ value: ResultMetric; label: string }>
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMetric(option.value)}
                  aria-pressed={metric === option.value}
                  className={`h-7 rounded-full px-3 text-xs font-bold transition ${
                    metric === option.value
                      ? "bg-pink-500 text-white"
                      : "text-gray-600 hover:bg-pink-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label={`実績件数（${scopeLabel}）`} value={`${summary.totalCount}件`} />
        <StatTile label="総売上" value={formatYen(summary.totalAmount)} />
        <StatTile label="平均単価" value={formatYen(summary.averageAmount)} />
        <StatTile
          label="月平均売上"
          value={formatYen(Math.round(summary.totalAmount / monthsInScope))}
          sub={`${monthsInScope}ヶ月分`}
        />
      </div>

      <ResultAddForm onAdded={reload} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <SectionCard
          title={`月別の実績（${scopeLabel}）`}
          description="納期の月ごとの集計です。行をタップすると実績一覧をその月に絞り込めます。"
        >
          <ul className="mt-2 space-y-1.5">
            {summary.monthly.map((month) => (
              <MeterRow
                key={month.ym}
                label={month.label}
                count={month.count}
                amount={month.amount}
                metric={metric}
                maxValue={maxMonthlyValue}
                selected={monthFilter === month.ym}
                onClick={() => setMonthFilter(monthFilter === month.ym ? null : month.ym)}
              />
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="タイプ別の実績"
          description="行をタップすると実績一覧をそのタイプに絞り込めます。"
        >
          <ul className="mt-2 space-y-1.5">
            {summary.byType.map((entry) => (
              <MeterRow
                key={entry.type}
                label={PROJECT_TYPE_LABELS[entry.type]}
                count={entry.count}
                amount={entry.amount}
                metric={metric}
                maxValue={maxTypeValue}
                selected={typeFilter === entry.type}
                onClick={() => setTypeFilter(typeFilter === entry.type ? null : entry.type)}
              />
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title={`実績一覧（${listItems.length}件）`}
        description="サムネイルをタップで拡大、画像ボタンで作品画像の登録・差し替えができます。"
      >
        {activeFilterChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">絞り込み:</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClear}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-pink-300 bg-pink-50 px-2.5 text-xs font-bold text-pink-700 hover:bg-pink-100"
                title="この絞り込みを解除"
              >
                {chip.label}
                <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
        {listError ? (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {listError}
          </p>
        ) : null}
        {listItems.length === 0 ? (
          <p className="mt-3 py-4 text-center text-xs text-gray-500">
            この条件の実績はありません。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {listItems.map((project) => (
              <CompletedProjectRow
                key={project.id}
                project={project}
                thumbUrl={thumbs[project.id]}
                editing={editingId === project.id}
                busy={deletingId === project.id}
                uploading={uploadingId === project.id}
                onBeginEdit={() => setEditingId(project.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={(patch) => handleSaveEdit(project.id, patch)}
                onDelete={() => handleDelete(project)}
                onPickImage={() => handlePickImage(project.id)}
                onPreview={() => setPreviewUrl(thumbs[project.id] ?? null)}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      {/* 画像の拡大表示 */}
      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-gray-900/70 p-4"
          role="dialog"
          aria-label="作品画像の拡大表示"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-h-[85vh] max-w-[92vw]">
            {/* 公開バケットの画像。クリックで閉じる */}
            <Image
              src={previewUrl}
              alt="作品画像"
              width={1200}
              height={1200}
              unoptimized
              className="h-auto max-h-[85vh] w-auto max-w-[92vw] rounded-xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-gray-700 shadow"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
