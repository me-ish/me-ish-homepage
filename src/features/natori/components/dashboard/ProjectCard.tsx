"use client";

import Link from "next/link";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { staffConsultationHref } from "@/features/natori/lib/consultationOverview";
import ConsultationStatus from "./ConsultationStatus";
import { useState } from "react";
import { ArrowRight, CalendarDays, CircleDollarSign, Clock4, Mail, MessageSquare, Pencil, Sparkles, AlertTriangle, Tag, Wallet, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ProjectEditForm from "./ProjectEditForm";
import type { UpdateNatoriProjectDetailsInput } from "@/features/natori/data/supabaseProjects";
import { natoriProjectStatusMeta, natoriStageMeta } from "@/features/natori/constants/mockProjects";
import {
  daysUntilDue,
  getAdvanceButtonLabel,
  getNextActionForStatus,
  getNextStatus,
  getStageForStatus,
  isProjectOverdue,
} from "@/features/natori/lib/projects";
import { getDeliveryPlanMeta } from "@/features/natori/lib/deliveryPlans";
import {
  computeProjectScheduling,
  formatHours,
  getCurrentStagePlan,
} from "@/features/natori/lib/scheduling";
import {
  formatNatoriProjectAmount,
  formatNatoriProjectDueDate,
  NATORI_PROJECT_TYPE_LABELS,
} from "@/features/natori/lib/projectReadModel";
import { cn } from "@/lib/utils";
import ProjectNoteSummary from "./ProjectNoteSummary";
import ProjectTaskChecklist from "./ProjectTaskChecklist";
import { RefundResultDetails } from "./RefundResultFigures";
import type { NatoriProject } from "@/features/natori/types/projects";

type ProjectCardProps = {
  project: NatoriProject;
  today: Date;
  onToggleTask: (projectId: string, taskId: string) => void;
  onAdvanceStatus?: (project: NatoriProject) => void;
  onConfirmPayment?: (project: NatoriProject) => void;
  /** ラフ提出・納品メールのパネルを開く（制作中の案件で表示） */
  onOpenMail?: (project: NatoriProject, kind: "rough" | "delivery") => void;
  onEditDetails?: (
    project: NatoriProject,
    patch: UpdateNatoriProjectDetailsInput
  ) => Promise<void>;
  advanceBusy?: boolean;
};

/** ラフ提出メールを出せる制作工程。完了後は同じ納品の再案内だけを許可する。 */
const WORK_MAIL_STATUSES = new Set<NatoriProject["status"]>([
  "rough",
  "lineart",
  "coloring",
  "waiting",
  "delivery_prep",
  "delivered",
]);

const dueDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return dueDateFormatter.format(date);
}

function formatStageMilestone(value: string) {
  return formatDueDate(value);
}

const priorityChipMap: Record<NonNullable<NatoriProject["priority"]>, { label: string; className: string }> = {
  high: { label: "優先度：高", className: "border-red-200 bg-red-50 text-red-800" },
  normal: { label: "優先度：中", className: "border-zinc-200 bg-zinc-50 text-zinc-700" },
  low: { label: "優先度：低", className: "border-zinc-200 bg-white text-zinc-600" },
};

export default function ProjectCard({
  project,
  today,
  onToggleTask,
  onAdvanceStatus,
  onConfirmPayment,
  onOpenMail,
  onEditDetails,
  advanceBusy,
}: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const status = natoriProjectStatusMeta[project.status];
  const overdue = isProjectOverdue(project, today);
  const days = project.dueDate === null ? null : daysUntilDue(project.dueDate, today);
  const priority = project.priority ? priorityChipMap[project.priority] : null;
  const stage = getStageForStatus(project.status);
  const stageMeta = stage ? natoriStageMeta[stage] : null;
  const deliveryPlanMeta = getDeliveryPlanMeta(project.deliveryPlan);
  const isRush = deliveryPlanMeta.isRush;
  const scheduling = computeProjectScheduling(project, today);
  const stagePlan = getCurrentStagePlan(project, today);

  const remainingLine = (
    <div className="flex items-center gap-2 text-xs sm:text-sm">
      <Clock4 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      {project.dueDate === null ? (
        <span className="min-w-0 font-bold">
          納期未定。スケジュール負荷には含めません。
        </span>
      ) : scheduling.isBlocked ? (
        <span className="min-w-0 font-bold">
          着金・確認待ち中。残 {formatHours(scheduling.remainingHours)}
        </span>
      ) : (
        <span className="min-w-0">
          残り作業 <span className="font-bold">{formatHours(scheduling.remainingHours)}</span>
        </span>
      )}
    </div>
  );
  const remainingTone = scheduling.isBlocked
    ? "border-zinc-200/80 bg-zinc-50 text-zinc-700"
    : scheduling.isOverdue
      ? "border-red-200 bg-red-50 text-red-900"
      : isRush
        ? cn("border-transparent", deliveryPlanMeta.softClassName)
        : "border-zinc-200/80 bg-zinc-50 text-zinc-800";

  return (
    <Card
      role="article"
      aria-label={project.title}
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]",
        overdue && "border-red-300 shadow-[0_0_0_1px_rgba(252,165,165,0.6)]"
      )}
    >
      <CardContent className="space-y-3 p-4 sm:space-y-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-base font-semibold leading-6 tracking-tight text-zinc-900 sm:text-lg sm:leading-7">
              {project.title}
            </p>
            <p className="mt-0.5 break-words text-sm text-zinc-600">{project.clientName}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-none",
                status.chipClassName
              )}
            >
              {status.label}
            </Badge>
            {isRush ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
                  deliveryPlanMeta.chipClassName
                )}
                title={deliveryPlanMeta.label}
              >
                <Zap className="h-3 w-3" aria-hidden />
                {deliveryPlanMeta.shortLabel}
              </span>
            ) : null}
            {priority ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium",
                  priority.className
                )}
              >
                {priority.label}
              </span>
            ) : null}
          </div>
        </div>

        {overdue ? (
          <div className={`${natoriAdminUi.alert.error} flex items-start gap-2`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="font-semibold">
              納期を {Math.abs(days ?? 0)} 日過ぎています。優先して進めましょう。
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-xl border p-3.5",
            stageMeta
              ? cn("border-black/[0.04]", stageMeta.softClassName)
              : "border-zinc-200/80 bg-zinc-50 text-zinc-900"
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            次やること
          </div>
          <p className="mt-1 break-words text-lg font-semibold leading-7 tracking-tight">
            {project.nextAction || getNextActionForStatus(project.status)}
          </p>
          <ProjectAdvanceButton
            project={project}
            onAdvanceStatus={onAdvanceStatus}
            onConfirmPayment={onConfirmPayment}
            busy={advanceBusy}
          />
        </div>

        {project.status === "awaiting_payment" ? (
          <div className={`${natoriAdminUi.alert.warning} flex items-start gap-2 text-xs sm:text-sm`}>
            <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>入金確認後に制作スケジュールへ反映されます。</span>
          </div>
        ) : null}

        {/* 各項目は「ラベル span」と「値 span.font-bold」の兄弟で組む（回帰スクリプトがこの組を読む） */}
        <div className="grid grid-cols-3 gap-2 text-sm text-zinc-700">
          <span className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-zinc-50 px-3 py-2">
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
              納期
            </span>
            <span className="break-words font-bold tabular-nums text-zinc-900">
              {formatNatoriProjectDueDate(project.dueDate, formatDueDate)}
            </span>
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-zinc-50 px-3 py-2">
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <CircleDollarSign className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
              金額
            </span>
            <span className="break-words font-bold tabular-nums text-zinc-900">
              {formatNatoriProjectAmount(project.amount)}
            </span>
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-zinc-50 px-3 py-2">
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <Tag className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
              種別
            </span>
            <span className="break-words font-bold text-zinc-900">
              {NATORI_PROJECT_TYPE_LABELS[project.type]}
            </span>
          </span>
        </div>

        {project.paidAt != null || project.paymentConfirmedAt != null || project.paidAmount != null ? <RefundResultDetails project={project} /> : null}

        {stagePlan ? (
          <div
            className={cn(
              "rounded-xl border p-3 text-xs sm:p-3.5 sm:text-sm",
              stagePlan.isOverdueMilestone
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-zinc-200/80 bg-white text-zinc-800"
            )}
          >
            <div className="mb-2.5 border-b border-black/[0.06] pb-2.5">{remainingLine}</div>
            <div className="flex items-center justify-between gap-2 text-xs font-semibold opacity-80">
              <span>現在のステージ</span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-semibold",
                  natoriStageMeta[stagePlan.stage].chipClassName
                )}
              >
                {natoriStageMeta[stagePlan.stage].label}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 divide-x divide-black/[0.06] text-center">
              <div>
                <p className="text-xs opacity-70">残</p>
                <p className="text-sm font-semibold tabular-nums">{formatHours(stagePlan.remainingHours)}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">平日1日</p>
                <p className="text-sm font-semibold tabular-nums">{formatHours(stagePlan.requiredPerDay)}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">今週の枠</p>
                <p className="text-sm font-semibold tabular-nums">{formatHours(stagePlan.requiredThisWeek)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs opacity-80">
              目安: {formatStageMilestone(stagePlan.milestoneDateISO)}
              {stagePlan.isOverdueMilestone ? "（過ぎてます）" : ""}
            </p>
          </div>
        ) : (
          <div className={cn("rounded-xl border px-3 py-2.5", remainingTone)}>{remainingLine}</div>
        )}

        {project.consultation !== undefined ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 p-3">
          <ConsultationStatus project={project} />
          <Link href={staffConsultationHref(project.id)} className={natoriAdminUi.btnSecondary}>
            <MessageSquare className="h-4 w-4 text-[#DB2777]" aria-hidden />
            相談を開く
          </Link>
        </div> : null}

        <ProjectNoteSummary note={project.note} />

        <ProjectTaskChecklist project={project} onToggle={onToggleTask} />

        {(onOpenMail && (WORK_MAIL_STATUSES.has(project.status) || project.status === "completed")) ||
        (onEditDetails && !editing) ? (
          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3 sm:pt-4">
            {onOpenMail && WORK_MAIL_STATUSES.has(project.status) ? (
              <button
                type="button"
                onClick={() => onOpenMail(project, "rough")}
                className={natoriAdminUi.btnSecondary}
                title="ラフ確認ファイルのリンク入りメールを送ります"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                ラフ提出メール
              </button>
            ) : null}
            {onOpenMail && (WORK_MAIL_STATUSES.has(project.status) || project.status === "completed") ? (
              <button
                type="button"
                onClick={() => onOpenMail(project, "delivery")}
                className={natoriAdminUi.btnSecondary}
                title="納品ページ（ダウンロード+受け取り確認）のリンク入りメールを送ります"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {project.status === "completed" ? "納品メールを再送" : "納品メール"}
              </button>
            ) : null}
            {onEditDetails && !editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`${natoriAdminUi.btnSecondary} ml-auto`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                編集
              </button>
            ) : null}
          </div>
        ) : null}

        {onEditDetails && editing ? (
          <ProjectEditForm
            project={project}
            onCancel={() => setEditing(false)}
            onSave={async (patch) => {
              await onEditDetails(project, patch);
              setEditing(false);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProjectAdvanceButton({
  project,
  onAdvanceStatus,
  onConfirmPayment,
  busy,
}: {
  project: NatoriProject;
  onAdvanceStatus?: (project: NatoriProject) => void;
  onConfirmPayment?: (project: NatoriProject) => void;
  busy?: boolean;
}) {
  const label = getAdvanceButtonLabel(project.status);
  if (!label) return null;
  const isConfirmPayment = project.status === "awaiting_payment";
  const handler = isConfirmPayment ? onConfirmPayment : onAdvanceStatus;
  if (!handler) return null;

  const nextStatus = getNextStatus(project.status);
  const nextLabel = nextStatus !== project.status ? natoriProjectStatusMeta[nextStatus]?.label : null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => handler(project)}
        disabled={busy}
        className={`${natoriAdminUi.btnPrimary} w-full sm:w-auto`}
      >
        {isConfirmPayment ? (
          <Wallet className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy ? "更新中…" : label}
      </button>
      {nextLabel ? (
        <p className={`mt-1 ${natoriAdminUi.caption}`}>押すと「{nextLabel}」になります</p>
      ) : null}
    </div>
  );
}
