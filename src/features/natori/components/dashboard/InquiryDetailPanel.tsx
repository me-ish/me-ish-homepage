"use client";

// features/natori/components/dashboard/InquiryDetailPanel.tsx
// 問い合わせ管理画面の詳細パネル。フォームの依頼内容を整形表示し、
// その場で見積もり / 支払い依頼メールの送信・入金確認・見送りができる。
import Link from "next/link";
import { Archive, CalendarDays, Mail, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import type { NatoriInquiryNoteView } from "@/features/natori/lib/inquiryNoteView";
import { formatYen } from "@/features/natori/lib/pricing";
import type { NatoriProject } from "@/features/natori/types/projects";
import type { OrderMailKind } from "./OrderMailPanel";

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
};

export default function InquiryDetailPanel({
  project,
  view,
  busy,
  onClose,
  onOpenMail,
  onCloseInquiry,
  onConfirmPayment,
}: InquiryDetailPanelProps) {
  const meta = natoriProjectStatusMeta[project.status];
  const receivedISO = project.startDate ?? project.dueDate;

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
              <span className="font-bold text-gray-900">{formatYen(project.amount)}</span>
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
          {/* フォームの項目 */}
          {view.fields.length > 0 ? (
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

          {/* キャラクター資料 */}
          {view.refImages.length > 0 || view.refText ? (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
                キャラクター資料
              </h3>
              {view.refImages.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {view.refImages.map((url, index) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="クリックで原寸表示"
                      >
                        {/* 依頼者がアップロードした公開バケット画像のプレビュー */}
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

          {/* 対応履歴 */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">
              対応履歴
            </h3>
            {view.logs.length === 0 ? (
              <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                まだ対応履歴がありません（受付のみ）。
              </p>
            ) : (
              <ol className="space-y-1.5">
                {view.logs.map((log, index) => (
                  <li
                    key={`${log.dateISO}-${index}`}
                    className="rounded-xl border border-pink-100 bg-pink-50/40 px-3 py-2 text-xs"
                  >
                    <p className="font-bold text-gray-900">
                      {formatDate(log.dateISO)}｜{log.label}
                    </p>
                    {log.body ? (
                      <p className="mt-0.5 whitespace-pre-wrap break-all text-gray-600">
                        {log.body}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* アクション */}
        <div className="flex flex-wrap items-center gap-2 border-t border-pink-100 p-4 sm:p-5">
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
              href="/natori/projects"
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
