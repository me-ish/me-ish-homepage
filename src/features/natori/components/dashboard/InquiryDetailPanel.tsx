"use client";

// features/natori/components/dashboard/InquiryDetailPanel.tsx
// 問い合わせ管理画面の詳細パネル。フォームの依頼内容を整形表示し、
// その場で見積もり / 支払い依頼メールの送信・入金確認・見送りができる。
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ConsultationStatus from "./ConsultationStatus";
import { useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Calculator,
  CalendarDays,
  ChevronDown,
  Mail,
  MessageCircle,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import type { NatoriInquiryNoteView } from "@/features/natori/lib/inquiryNoteView";
import {
  formatNatoriProjectAmount,
  getNatoriInquiryReceivedISO,
  NATORI_PROJECT_TYPE_LABELS,
} from "@/features/natori/lib/projectReadModel";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import { collectNatoriInquiryReviewWarnings } from "@/features/natori/lib/inquiryReviewWarnings";
import { isPreworkStatus } from "@/features/natori/lib/projects";
import type {
  NatoriConcreteProjectType,
  NatoriProject,
} from "@/features/natori/types/projects";
import type { UpdateNatoriProjectDetailsInput } from "@/features/natori/data/supabaseProjects";
import InquiryAdminCorrectionForm from "./inquiry/InquiryAdminCorrectionForm";
import InquiryReferenceFiles from "./inquiry/InquiryReferenceFiles";
import InquiryReferenceLinks from "./inquiry/InquiryReferenceLinks";
import InquiryRequestSummary from "./inquiry/InquiryRequestSummary";
import InquiryReviewWarnings from "./inquiry/InquiryReviewWarnings";
import InquiryTypeConfirmation from "./inquiry/InquiryTypeConfirmation";
import type { OrderMailKind } from "./OrderMailPanel";
import ProjectActivityTimeline from "./ProjectActivityTimeline";
import ConsultationThread from "@/features/natori/components/consultation/ConsultationThread";

const ESTIMATE_MAIL_STATUSES: ReadonlySet<NatoriProject["status"]> = new Set([
  "inquiry",
  "consulting",
  "estimating",
  "quoted",
]);
const PAYMENT_MAIL_STATUSES: ReadonlySet<NatoriProject["status"]> = new Set([
  "quoted",
  "awaiting_payment",
]);

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${year}/${month}/${day}`;
}

type InquiryDetailPanelProps = {
  project: NatoriProject;
  view: NatoriInquiryNoteView;
  busy: boolean;
  demoMode?: boolean;
  initialScreen?: "overview" | "conversation";
  onConversationChanged?: () => void;
  refreshError?: string;
  onRetryRefresh?: () => void;
  onClose: () => void;
  onOpenMail: (kind: OrderMailKind) => void;
  onCloseInquiry: () => void;
  onConfirmPayment: () => void;
  /** 「この内容で見積もりを作る」のリンク先（デモではデモ用見積もりページへ） */
  estimateHref?: string;
  /** 「案件ボードへ」のリンク先（デモではデモ用案件ページへ） */
  projectsHref?: string;
  /** 案件種別の確定（task 生成を伴う専用 RPC 経路） */
  onConfirmType?: (projectType: NatoriConcreteProjectType) => Promise<void>;
  /** 金額 / 納品予定日 / 納期プランの管理補正 */
  onSaveCorrection?: (patch: UpdateNatoriProjectDetailsInput) => Promise<void>;
  /** 次のアクションの更新（既存の status 遷移 API を同一 status で使う） */
  onSaveNextAction?: (nextAction: string) => Promise<void>;
  onAddLink?: (url: string, label: string | null) => Promise<void>;
  onUpdateLink?: (
    linkId: string,
    url: string,
    label: string | null,
  ) => Promise<void>;
  onDeleteLink?: (linkId: string) => Promise<void>;
};

export default function InquiryDetailPanel({
  project,
  view,
  busy,
  demoMode,
  initialScreen = "overview",
  onConversationChanged,
  refreshError,
  onRetryRefresh,
  onClose,
  onOpenMail,
  onCloseInquiry,
  onConfirmPayment,
  estimateHref,
  projectsHref,
  onConfirmType,
  onSaveCorrection,
  onSaveNextAction,
  onAddLink,
  onUpdateLink,
  onDeleteLink,
}: InquiryDetailPanelProps) {
  const [screen, setScreen] = useState<"overview" | "conversation">(initialScreen);
  const returnFocus = useRef<HTMLElement | null>(typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const meta = natoriProjectStatusMeta[project.status];
  const receivedISO = getNatoriInquiryReceivedISO(project);
  // legacy note 由来の画像は既存表示を維持し、structured 案件は署名URL付きの
  // referenceFiles を使う。
  const legacyReferenceImages = view.refImages;
  const referenceFiles = project.referenceFiles ?? [];
  const referenceLinks = project.referenceLinks ?? [];
  const hasReferences =
    project.referenceFilesState==="unavailable" || referenceFiles.length > 0 ||
    legacyReferenceImages.length > 0 ||
    Boolean(view.refText) ||
    referenceLinks.length > 0;
  const archived = Boolean(project.deletedAt);
  const readOnly = archived || project.status === "closed";

  // 工程ごとに「いま一番やること」を主ボタンにする。表示条件は従来の集合をそのまま使う。
  const primaryAction: "estimate" | "payment-mail" | "confirm-payment" | "reply" =
    !readOnly && project.status === "awaiting_payment"
      ? "confirm-payment"
      : !readOnly && project.status === "quoted" && PAYMENT_MAIL_STATUSES.has(project.status)
        ? "payment-mail"
        : !readOnly &&
            ESTIMATE_MAIL_STATUSES.has(project.status) &&
            project.status !== "quoted" &&
            Boolean(estimateHref)
          ? "estimate"
          : "reply";

  // 未対応 version / 壊れた JSON でも throw せず、表示可能な範囲だけを描画する。
  const requestView = buildNatoriInquiryRequestView(project.requestData);
  const reviewWarnings = collectNatoriInquiryReviewWarnings({
    projectType: project.type,
    amount: project.amount,
    dueDateISO: project.dueDate,
    isPrework: isPreworkStatus(project.status),
    requestView,
  });

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent hideCloseButton aria-describedby={undefined} aria-label="問い合わせの詳細"
        onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}
        className="flex h-[100dvh] w-full max-w-2xl flex-col gap-0 border border-zinc-200/80 bg-white p-0 shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
        {/* ヘッダー */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200/80 p-4 sm:p-5">
          <div className="min-w-0">
            {screen === "conversation" ? (
              <button
                type="button"
                onClick={() => setScreen("overview")}
                className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-[#BE185D]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> 案件詳細へ戻る
              </button>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="break-words text-base font-bold text-zinc-900">
                {screen === "conversation"
                  ? `${project.clientName}さんとの相談`
                  : `${project.clientName}｜${project.title}`}
              </DialogTitle>
              <span
                className={cn(
                  "inline-block rounded-full border px-2 py-0.5 text-xs font-bold",
                  meta.chipClassName,
                )}
              >
                {meta.label}
              </span>
            </div>
            <ConsultationStatus project={project} />
            {refreshError ? <div role="alert" className="mt-2 text-xs text-amber-800">
              {refreshError} 表示中の案件情報が古い可能性があります。
              {onRetryRefresh ? <button type="button" onClick={onRetryRefresh} className="ml-2 min-h-8 font-bold underline">案件情報を再取得</button> : null}
            </div> : null}
            {screen === "overview" ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  受付 {formatDate(receivedISO)}
                </span>
                <span className="font-bold text-zinc-900">
                  {formatNatoriProjectAmount(project.amount)}
                </span>
                <span className="font-bold text-zinc-900">
                  種別 {NATORI_PROJECT_TYPE_LABELS[project.type]}
                </span>
                {view.email ? (
                  <span className="break-all">{view.email}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={natoriAdminUi.btnIcon}
            aria-label="閉じる"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {screen === "conversation" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {!demoMode ? (
              <ConsultationThread
                mode="staff"
                standalone
                closed={readOnly}
                onChanged={onConversationChanged}
                projectId={project.id}
                clientEmail={project.clientEmail ?? view.email ?? undefined}
              />
            ) : null}
          </div>
        ) : null}
        <div
          className={`${screen === "conversation" ? "hidden" : "min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"}`}
        >
          {/* 依頼の原回答を最初に見せる */}
          <InquiryRequestSummary view={requestView} />

          {archived ? (
            <p className="rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-xs text-zinc-600">
              アーカイブ済みの案件です。内容の閲覧のみ可能で、確定・編集はできません。
            </p>
          ) : null}

          {/* legacy: フォームの項目（note 由来） */}
          {requestView.kind !== "structured" && view.fields.length > 0 ? (
            <section>
              <h3 className={`mb-2 ${natoriAdminUi.groupLabel}`}>
                ご依頼内容
              </h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 text-sm sm:grid-cols-2">
                {view.fields.map((field) => (
                  <div key={field.label} className="flex min-w-0 gap-2">
                    <dt className="shrink-0 font-bold text-zinc-600">
                      {field.label}:
                    </dt>
                    <dd className="min-w-0 break-words text-zinc-900">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* 資料がある案件だけ表示する。空のURL欄は案件設定へ。 */}
          {hasReferences ? (
            <section className="space-y-3">
              <h3 className={natoriAdminUi.groupLabel}>
                参考資料
              </h3>
              <InquiryReferenceFiles files={referenceFiles} acquisitionState={project.referenceFilesState} />
              {legacyReferenceImages.length > 0 || view.refText ? (
                <section>
                  {legacyReferenceImages.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {legacyReferenceImages.map((url, index) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="クリックで原寸表示"
                          >
                            {/* 非公開バケットから発行した短時間署名URLのプレビュー */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`添付画像 ${index + 1}`}
                              className="h-24 w-24 rounded-lg border border-zinc-200 object-cover transition hover:opacity-80"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {view.refText ? (
                    <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 text-sm text-zinc-900">
                      {view.refText}
                    </p>
                  ) : null}
                </section>
              ) : null}
              {referenceLinks.length > 0 &&
              onAddLink &&
              onUpdateLink &&
              onDeleteLink ? (
                <ul className="space-y-2">
                  {referenceLinks.map((link) => (
                    <li
                      key={link.id}
                      className="rounded-xl border border-zinc-200/80 bg-white p-3 text-sm"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="block break-all font-bold text-[#9D174D] underline underline-offset-2"
                      >
                        {link.label || link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {/* 依頼の詳細・その他 */}
          {view.details ? (
            <section>
              <h3 className={`mb-2 ${natoriAdminUi.groupLabel}`}>
                ご依頼の詳細
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200/80 bg-white p-3 text-sm leading-6 text-zinc-900 shadow-sm">
                {view.details}
              </p>
            </section>
          ) : null}
          {view.message ? (
            <section>
              <h3 className={`mb-2 ${natoriAdminUi.groupLabel}`}>
                その他・ご質問
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200/80 bg-white p-3 text-sm leading-6 text-zinc-900 shadow-sm">
                {view.message}
              </p>
            </section>
          ) : null}

          {/* 手入力案件のメモ */}
          {!view.isAutoInquiry && view.plainNote ? (
            <section>
              <h3 className={`mb-2 ${natoriAdminUi.groupLabel}`}>
                メモ
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200/80 bg-white p-3 text-sm leading-6 text-zinc-900 shadow-sm">
                {view.plainNote}
              </p>
            </section>
          ) : null}

          {!demoMode ? (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-sm font-bold text-zinc-900">
                相談のやり取り
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                依頼者との会話と添付ファイルを確認できます。
              </p>
              <button
                type="button"
                onClick={() => setScreen("conversation")}
                className={`${natoriAdminUi.btnPrimary} mt-3`}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                相談を開く
              </button>
            </section>
          ) : null}
          <InquiryReviewWarnings warnings={reviewWarnings} />

          <details className="group rounded-xl border border-zinc-200/80 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-[#9D174D] marker:hidden [&::-webkit-details-marker]:hidden">
              案件の設定
              <ChevronDown
                className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <div className="space-y-4 border-t border-zinc-200/80 p-3">
              {onSaveCorrection && onSaveNextAction && !readOnly ? (
                <InquiryAdminCorrectionForm
                  project={project}
                  disabled={busy}
                  onSave={onSaveCorrection}
                  onSaveNextAction={onSaveNextAction}
                />
              ) : null}
              {onConfirmType && !readOnly ? (
                <InquiryTypeConfirmation
                  projectType={project.type}
                  taskCount={project.tasks.length}
                  disabled={busy}
                  onConfirm={onConfirmType}
                />
              ) : null}
              {onAddLink && onUpdateLink && onDeleteLink && !readOnly ? (
                <InquiryReferenceLinks
                  links={referenceLinks}
                  readOnly={archived}
                  onAdd={onAddLink}
                  onUpdate={onUpdateLink}
                  onDelete={onDeleteLink}
                />
              ) : null}
            </div>
          </details>
          <ProjectActivityTimeline
            projectId={project.id}
            legacyLogs={view.logs}
          />
        </div>

        {/* アクション */}
        <div
          className={`${screen === "conversation" ? "hidden" : "flex shrink-0 flex-wrap items-center gap-2 border-t border-zinc-200/80 bg-white px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 sm:p-5"}`}
        >
          {primaryAction === "estimate" && estimateHref ? (
            <Link
              href={estimateHref}
              className={`${natoriAdminUi.btnPrimary} w-full whitespace-nowrap sm:w-auto`}
              title="依頼内容を見積もりツールに貼り付けた状態で開きます（概算とメール下書きが自動で出ます）"
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden />
              見積りを作る
            </Link>
          ) : null}
          {primaryAction === "payment-mail" ? (
            <button
              type="button"
              onClick={() => onOpenMail("payment")}
              disabled={busy}
              className={`${natoriAdminUi.btnPrimary} w-full whitespace-nowrap sm:w-auto`}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              支払い依頼メールを送る
            </button>
          ) : null}
          {primaryAction === "confirm-payment" ? (
            <button
              type="button"
              onClick={onConfirmPayment}
              disabled={busy}
              className={`${natoriAdminUi.btnPrimary} w-full whitespace-nowrap sm:w-auto`}
              title="銀行振込などシステム外の入金を手動で確認したときに使います"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              {busy ? "更新中…" : "入金確認してラフ開始"}
            </button>
          ) : null}
          {!demoMode ? (
            <button
              type="button"
              onClick={() => setScreen("conversation")}
              className={`${primaryAction === "reply" ? natoriAdminUi.btnPrimary : natoriAdminUi.btnSecondary} min-w-0 flex-1 whitespace-nowrap sm:flex-none`}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              {readOnly ? "相談履歴を開く" : "相談に返信"}
            </button>
          ) : null}
          <details className="group relative ml-auto shrink-0">
            <summary
              className={`${natoriAdminUi.btnSecondary} cursor-pointer list-none marker:hidden [&::-webkit-details-marker]:hidden`}
            >
              その他 ↑
            </summary>
            <div className="absolute bottom-full right-0 z-10 mb-2 flex max-h-[50dvh] w-[min(88vw,20rem)] flex-col gap-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
              {!readOnly && ESTIMATE_MAIL_STATUSES.has(project.status) && primaryAction !== "estimate" && estimateHref ? (
                <Link
                  href={estimateHref}
                  className={natoriAdminUi.btnSecondary}
                  title="依頼内容を見積もりツールに貼り付けた状態で開きます（概算とメール下書きが自動で出ます）"
                >
                  <Calculator className="h-3.5 w-3.5" aria-hidden />
                  見積りを作る
                </Link>
              ) : null}
              {!readOnly && ESTIMATE_MAIL_STATUSES.has(project.status) ? (
                <button
                  type="button"
                  onClick={() => onOpenMail("estimate")}
                  disabled={busy}
                  className={natoriAdminUi.btnSecondary}
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  見積もりメール
                  {project.status === "quoted" ? "を再送" : "を送る"}
                </button>
              ) : null}
              {!readOnly && PAYMENT_MAIL_STATUSES.has(project.status) && primaryAction !== "payment-mail" ? (
                <button
                  type="button"
                  onClick={() => onOpenMail("payment")}
                  disabled={busy}
                  className={natoriAdminUi.btnSecondary}
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  支払い依頼メール
                  {!readOnly && project.status === "awaiting_payment" ? "を再送" : "を送る"}
                </button>
              ) : null}
              <Link
                href={projectsHref ?? "/natori/projects"}
                className={natoriAdminUi.btnSecondary}
              >
                案件ボードへ
              </Link>
              {!readOnly && isPreworkStatus(project.status) ? (
                <div className="border-t border-zinc-200 pt-2">
                  <button
                    type="button"
                    onClick={onCloseInquiry}
                    disabled={busy}
                    className={`${natoriAdminUi.btnDanger} w-full`}
                    title="条件がまとまらなかった相談を一覧から外します（履歴は残ります）"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden />
                    見送りにする
                  </button>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
