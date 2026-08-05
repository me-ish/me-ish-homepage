"use client";

// features/natori/components/dashboard/InquiryDetailPanel.tsx
// 問い合わせ管理画面の詳細パネル。フォームの依頼内容を整形表示し、
// その場で見積もり / 支払い依頼メールの送信・入金確認・見送りができる。
import Link from "next/link";
import { Archive, Calculator, CalendarDays, Mail, Wallet, X } from "lucide-react";
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
  onUpdateLink?: (linkId: string, url: string, label: string | null) => Promise<void>;
  onDeleteLink?: (linkId: string) => Promise<void>;
};

export default function InquiryDetailPanel({
  project,
  view,
  busy,
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
  const meta = natoriProjectStatusMeta[project.status];
  const receivedISO = getNatoriInquiryReceivedISO(project);
  // legacy note 由来の画像は既存表示を維持し、structured 案件は署名URL付きの
  // referenceFiles を使う。
  const legacyReferenceImages = view.refImages;
  const referenceFiles = project.referenceFiles ?? [];
  const referenceLinks = project.referenceLinks ?? [];
  const archived = Boolean(project.deletedAt);

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
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-gray-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="問い合わせの詳細"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-pink-100 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-3 border-b border-pink-100 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-base font-black text-gray-900">
                {project.clientName}｜{project.title}
              </h2>
              <span
                className={cn(
                  "inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  meta.chipClassName
                )}
              >
                {meta.label}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                受付 {formatDate(receivedISO)}
              </span>
              <span className="font-bold text-gray-900">
                {formatNatoriProjectAmount(project.amount)}
              </span>
              <span className="font-bold text-gray-900">
                種別 {NATORI_PROJECT_TYPE_LABELS[project.type]}
              </span>
              {view.email ? <span className="break-all">{view.email}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* 2. 要確認事項 */}
          <InquiryReviewWarnings warnings={reviewWarnings} />

          {/* 3. 原依頼内容（structured のみ。legacy は下の note 表示を使う） */}
          <InquiryRequestSummary view={requestView} />

          {archived ? (
            <p className="rounded-xl border border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
              アーカイブ済みの案件です。内容の閲覧のみ可能で、確定・編集はできません。
            </p>
          ) : null}

          {/* 4. 管理確定項目 */}
          {onSaveCorrection && onSaveNextAction && !archived ? (
            <InquiryAdminCorrectionForm
              project={project}
              disabled={busy}
              onSave={onSaveCorrection}
              onSaveNextAction={onSaveNextAction}
            />
          ) : null}

          {/* 5. 参考画像 */}
          <InquiryReferenceFiles files={referenceFiles} />

          {/* 6. 外部リンク */}
          {onAddLink && onUpdateLink && onDeleteLink ? (
            <InquiryReferenceLinks
              links={referenceLinks}
              readOnly={archived}
              onAdd={onAddLink}
              onUpdate={onUpdateLink}
              onDelete={onDeleteLink}
            />
          ) : null}

          {/* 7. 案件種別の確定・タスク生成 */}
          {onConfirmType && !archived ? (
            <InquiryTypeConfirmation
              projectType={project.type}
              taskCount={project.tasks.length}
              disabled={busy}
              onConfirm={onConfirmType}
            />
          ) : null}

          {/* legacy: フォームの項目（note 由来） */}
          {requestView.kind !== "structured" && view.fields.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
                ご依頼内容
              </h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl border border-pink-100 bg-pink-50/40 p-3 text-sm sm:grid-cols-2">
                {view.fields.map((field) => (
                  <div key={field.label} className="flex min-w-0 gap-2">
                    <dt className="shrink-0 font-bold text-gray-600">{field.label}:</dt>
                    <dd className="min-w-0 break-words text-gray-900">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* legacy: note に埋め込まれた資料URL・資料テキスト */}
          {legacyReferenceImages.length > 0 || view.refText ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
                キャラクター資料（旧形式）
              </h3>
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
                          className="h-24 w-24 rounded-lg border border-pink-200 object-cover transition hover:opacity-80"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {view.refText ? (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-pink-100 bg-pink-50/40 p-3 text-sm text-gray-900">
                  {view.refText}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* 依頼の詳細・その他 */}
          {view.details ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
                ご依頼の詳細
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-pink-100 bg-white p-3 text-sm leading-6 text-gray-900 shadow-sm">
                {view.details}
              </p>
            </section>
          ) : null}
          {view.message ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
                その他・ご質問
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-pink-100 bg-white p-3 text-sm leading-6 text-gray-900 shadow-sm">
                {view.message}
              </p>
            </section>
          ) : null}

          {/* 手入力案件のメモ */}
          {!view.isAutoInquiry && view.plainNote ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
                メモ
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-xl border border-pink-100 bg-white p-3 text-sm leading-6 text-gray-900 shadow-sm">
                {view.plainNote}
              </p>
            </section>
          ) : null}

          <ProjectActivityTimeline projectId={project.id} legacyLogs={view.logs} />
        </div>

        {/* アクション */}
        <div className="flex flex-wrap items-center gap-2 border-t border-pink-100 p-4 sm:p-5">
          {ESTIMATE_MAIL_STATUSES.has(project.status) && estimateHref ? (
            <Link
              href={estimateHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rose-300 bg-white px-4 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-50"
              title="依頼内容を見積もりツールに貼り付けた状態で開きます（概算とメール下書きが自動で出ます）"
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden />
              この内容で見積もりを作る
            </Link>
          ) : null}
          {ESTIMATE_MAIL_STATUSES.has(project.status) ? (
            <button
              type="button"
              onClick={() => onOpenMail("estimate")}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pink-500 px-4 text-xs font-bold text-white shadow-sm hover:bg-pink-600 disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              見積もりメール{project.status === "quoted" ? "を再送" : "を送る"}
            </button>
          ) : null}
          {PAYMENT_MAIL_STATUSES.has(project.status) ? (
            <button
              type="button"
              onClick={() => onOpenMail("payment")}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-orange-500 px-4 text-xs font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              支払い依頼メール{project.status === "awaiting_payment" ? "を再送" : "を送る"}
            </button>
          ) : null}
          {project.status === "awaiting_payment" ? (
            <button
              type="button"
              onClick={onConfirmPayment}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-orange-300 bg-white px-4 text-xs font-bold text-orange-700 shadow-sm hover:bg-orange-50 disabled:opacity-60"
              title="銀行振込などシステム外の入金を手動で確認したときに使います"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              {busy ? "更新中…" : "入金確認してラフ開始"}
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={projectsHref ?? "/natori/projects"}
              className="inline-flex h-9 items-center rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              案件ボードへ
            </Link>
            <button
              type="button"
              onClick={onCloseInquiry}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              title="条件がまとまらなかった相談を一覧から外します（履歴は残ります）"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
              見送り
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
