"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  FolderPlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_NATORI_DELIVERY_PLAN,
  NATORI_DELIVERY_PLANS,
  NATORI_DELIVERY_PLAN_ORDER,
  calculateDueDate,
} from "@/features/natori/lib/deliveryPlans";
import { getNextActionForStatus, toISODate } from "@/features/natori/lib/projects";
import { formatYen } from "@/features/natori/lib/pricing";
import { createNatoriProject } from "@/features/natori/data/supabaseProjects";
import { cn } from "@/lib/utils";
import type {
  NatoriDeliveryPlan,
  NatoriProjectStatus,
  NatoriProjectType,
} from "@/features/natori/types/projects";

// Status options exposed in the unified register form. We intentionally cap
// these at the pre-rough flow: rough制作は入金確認後に開始する運用なので、
// 通常登録でいきなり rough 以降を選ばせるとフローを飛ばしてしまうため。
export const NATORI_REGISTER_STATUS_OPTIONS: Array<{
  value: NatoriProjectStatus;
  label: string;
}> = [
  { value: "inquiry", label: "依頼受付" },
  { value: "estimating", label: "見積もり中" },
  { value: "quoted", label: "見積もり提示済み" },
  { value: "awaiting_payment", label: "入金待ち" },
];

export type ProjectRegisterMode = "estimate" | "manual";

/**
 * estimate モード: 見積もりツール内から呼ばれる。金額・納期がもう出ているので
 *   既定は「見積もり提示済み」。
 * manual モード: 案件管理ボードから直接登録する。依頼が来たばかりで料金等が
 *   未確定の想定なので、既定は「依頼受付」。
 */
export function getDefaultStatusForMode(
  mode: ProjectRegisterMode
): NatoriProjectStatus {
  return mode === "estimate" ? "quoted" : "inquiry";
}

const PROJECT_TYPE_LABELS: Record<NatoriProjectType, string> = {
  icon: "アイコン",
  sd: "SD",
  standing: "立ち絵",
  illustration: "イラスト",
};

type ProjectRegisterDefaults = {
  title?: string;
  type?: NatoriProjectType;
  amount?: number;
  note?: string;
  deliveryPlan?: NatoriDeliveryPlan;
  startDateISO?: string;
  dueDateISO?: string;
};

type ProjectRegisterFormProps = {
  mode: ProjectRegisterMode;
  /** Heading shown above the form. */
  heading?: string;
  /** Secondary description text under the heading. */
  description?: string;
  /** Icon rendered in the heading badge. Defaults to FolderPlus. */
  icon?: LucideIcon;
  defaults?: ProjectRegisterDefaults;
  /** Override the auto default-by-mode if the caller wants. */
  defaultStatus?: NatoriProjectStatus;
  /**
   * estimate モードでは金額・納期・プランが既に確定しているので、フォーム内では
   * 編集 UI を出さずに「表示のみ」になる。manual モードでは全て編集可能。
   */
  fixedAmount?: boolean;
  fixedDeliveryPlan?: boolean;
  /** Whether the form starts open (default false, opens on user click). */
  initialOpen?: boolean;
  /** Whether the form starts collapsed under a toggle. Defaults to true. */
  collapsible?: boolean;
  /** Fired after successful registration. */
  onCreated?: (id: string) => void;
};

export default function ProjectRegisterForm({
  mode,
  heading,
  description,
  icon,
  defaults,
  defaultStatus,
  fixedAmount = false,
  fixedDeliveryPlan = false,
  initialOpen = false,
  collapsible = true,
  onCreated,
}: ProjectRegisterFormProps) {
  const HeadingIcon = icon ?? FolderPlus;
  const resolvedHeading =
    heading ??
    (mode === "estimate"
      ? "この見積もりを案件管理に登録"
      : "依頼・案件を案件管理に登録");
  const resolvedDescription =
    description ??
    (mode === "estimate"
      ? "依頼者名・タイトル・初期ステータスを確認して案件管理に追加します。"
      : "依頼が来た段階の案件でも、見積もり済の案件でも登録できます。");

  const [open, setOpen] = useState(initialOpen);

  const initialStatus = defaultStatus ?? getDefaultStatusForMode(mode);

  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [type, setType] = useState<NatoriProjectType>(defaults?.type ?? "illustration");
  const [status, setStatus] = useState<NatoriProjectStatus>(initialStatus);
  const [amount, setAmount] = useState<number>(defaults?.amount ?? 0);
  const [deliveryPlan, setDeliveryPlan] = useState<NatoriDeliveryPlan>(
    defaults?.deliveryPlan ?? DEFAULT_NATORI_DELIVERY_PLAN
  );
  const [startDateISO, setStartDateISO] = useState<string>(
    defaults?.startDateISO ?? toISODate(new Date())
  );
  const [dueDateISO, setDueDateISO] = useState<string>(
    defaults?.dueDateISO ?? calculateDueDate(
      defaults?.startDateISO ?? toISODate(new Date()),
      defaults?.deliveryPlan ?? DEFAULT_NATORI_DELIVERY_PLAN
    )
  );
  const [note, setNote] = useState<string>(defaults?.note ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Keep estimate-mode pre-fills in sync when the upstream estimate changes.
  // Important: don't clobber what the user typed into client name / note.
  useEffect(() => {
    if (defaults?.title !== undefined) setTitle(defaults.title);
    if (defaults?.type !== undefined) setType(defaults.type);
    if (defaults?.amount !== undefined) setAmount(defaults.amount);
    if (defaults?.deliveryPlan !== undefined) setDeliveryPlan(defaults.deliveryPlan);
    if (defaults?.startDateISO !== undefined) setStartDateISO(defaults.startDateISO);
    if (defaults?.dueDateISO !== undefined) setDueDateISO(defaults.dueDateISO);
    if (defaults?.note !== undefined) setNote(defaults.note);
    setCreatedId(null);
    setError(null);
  }, [
    defaults?.title,
    defaults?.type,
    defaults?.amount,
    defaults?.deliveryPlan,
    defaults?.startDateISO,
    defaults?.dueDateISO,
    defaults?.note,
  ]);

  // Auto-recompute due date in manual mode when the user changes start/plan
  // without manually overriding due date. We approximate "didn't override" by
  // re-computing whenever start or plan changes — keeps the UX simple.
  useEffect(() => {
    if (fixedDeliveryPlan) return;
    if (!startDateISO) return;
    setDueDateISO(calculateDueDate(startDateISO, deliveryPlan));
  }, [startDateISO, deliveryPlan, fixedDeliveryPlan]);

  const dueDateLabel = useMemo(
    () => (dueDateISO ? formatHumanDate(dueDateISO) : "—"),
    [dueDateISO]
  );

  const handleSubmit = async () => {
    if (!clientName.trim() || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    setCreatedId(null);
    try {
      const id = await createNatoriProject({
        title: title.trim(),
        clientName: clientName.trim(),
        amount: Math.max(0, Number.isFinite(amount) ? Math.round(amount) : 0),
        type,
        status,
        deliveryPlan,
        startDateISO: startDateISO || undefined,
        dueDateISO: dueDateISO || undefined,
        nextAction: getNextActionForStatus(status),
        note: note.trim() ? note.trim() : undefined,
      });
      setCreatedId(id);
      onCreated?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const headingButton = (
    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pink-500 text-white">
          <HeadingIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-pink-900">{resolvedHeading}</p>
          <p className="text-xs text-pink-800/80">{resolvedDescription}</p>
        </div>
      </div>
      {collapsible ? (
        <span className="shrink-0 text-pink-700">
          {open ? (
            <ChevronUp className="h-5 w-5" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5" aria-hidden />
          )}
        </span>
      ) : null}
    </button>
  );

  const body = createdId ? (
    <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-3 text-sm text-emerald-900 sm:p-4">
      <p className="font-black">案件管理に追加しました。</p>
      <p className="mt-1 text-xs leading-5">
        案件カレンダーから内容を確認できます。
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href="/natori/projects"
          className="inline-flex h-9 items-center rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600"
        >
          案件カレンダーを開く
        </Link>
        <button
          type="button"
          onClick={() => {
            setCreatedId(null);
            setClientName("");
            setTitle(defaults?.title ?? "");
            setNote(defaults?.note ?? "");
          }}
          className="inline-flex h-9 items-center rounded-full border border-pink-300 bg-white px-4 text-xs font-bold text-pink-700 hover:bg-pink-50"
        >
          続けて登録
        </button>
      </div>
    </div>
  ) : (
    <div className="mt-4 space-y-3">
      <label className="block text-sm">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
          依頼者名（必須）
        </span>
        <input
          type="text"
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
          placeholder="例: 月乃さん"
          className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
      </label>
      <label className="block text-sm">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
          案件タイトル
        </span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={mode === "manual" ? "例: 配信用立ち絵" : "例: バストアップアイコン"}
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
            初期ステータス
          </span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as NatoriProjectStatus)}
            className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
          >
            {NATORI_REGISTER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fixedAmount ? (
        <div className="rounded-xl border border-pink-100 bg-white p-3 text-xs leading-5 text-pink-900">
          <p>
            <span className="font-bold">金額:</span> {formatYen(amount)}
          </p>
          <p>
            <span className="font-bold">納期プラン:</span>{" "}
            {NATORI_DELIVERY_PLANS[deliveryPlan].label}
          </p>
          <p>
            <span className="font-bold">納期:</span> {dueDateLabel}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <span className="mt-1 block text-[11px] text-pink-700/80">
                未確定なら 0 で保存できます。
              </span>
            </label>
            <label className="block text-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
                開始日
              </span>
              <input
                type="date"
                value={startDateISO}
                onChange={(event) => setStartDateISO(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </label>
          </div>
          <div className="rounded-2xl border border-pink-200 bg-pink-50/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">
              納期プラン
            </p>
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
                    <p className="mt-0.5 text-[11px] leading-4 opacity-80">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-col gap-1 rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-pink-700 sm:w-24">
                納期
              </span>
              <input
                type="date"
                value={dueDateISO}
                onChange={(event) => setDueDateISO(event.target.value)}
                className="h-9 flex-1 rounded-md border border-pink-200 bg-white px-2 text-sm text-pink-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
          </div>
        </>
      )}

      <label className="block text-sm">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-pink-700">
          依頼内容・確認事項メモ
        </span>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="依頼文、用途、サイズ、人数、表情差分、商用利用、希望納期、確認事項、やり取りメモ等。"
          className="mt-1 min-h-[120px] resize-y border-pink-200 bg-white text-sm leading-6 text-gray-900 focus-visible:ring-pink-300"
        />
      </label>

      {status === "awaiting_payment" ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-900">
          入金待ちとして登録します。制作スケジュールに反映されるのは
          「入金確認してラフ開始」を押してからです。
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <Button
        onClick={handleSubmit}
        disabled={submitting || !clientName.trim() || !title.trim()}
        className="h-11 w-full rounded-full bg-pink-500 px-5 text-sm font-bold text-white hover:bg-pink-600 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "追加中…" : "案件管理に追加"}
      </Button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-pink-200 bg-pink-50/60 p-4 sm:p-5">
      {collapsible ? headingButton : (
        <div className="flex w-full items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pink-500 text-white">
            <HeadingIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-pink-900">{resolvedHeading}</p>
            <p className="text-xs text-pink-800/80">{resolvedDescription}</p>
          </div>
        </div>
      )}

      {(!collapsible || open) ? body : null}
    </div>
  );
}

function formatHumanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
