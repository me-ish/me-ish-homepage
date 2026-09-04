"use client";

// features/natori/components/dashboard/ProjectNoteSummary.tsx
// 案件カード内のメモ表示。フォーム自動起票の全文（メール・添付URL・対応ログ等）を
// そのまま出すとカードが埋まるため、parseInquiryNote で構造化し折りたたんで表示する。
// 手入力メモは短ければそのまま、長ければ展開式にする。
import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Mail } from "lucide-react";
import { parseInquiryNote } from "@/features/natori/lib/inquiryNoteView";

/** 折りたたみ時に見せる主要項目（自動起票のラベル行から抜粋） */
const SUMMARY_FIELD_LABELS = ["ご依頼の種類", "ご予算", "希望納期"];

/** 手入力メモをトグルなしでそのまま見せる長さの上限 */
const PLAIN_NOTE_INLINE_LIMIT = 120;

const logDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
});

function formatLogDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return logDateFormatter.format(new Date(year, month - 1, day));
}

export default function ProjectNoteSummary({ note }: { note: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const view = parseInquiryNote(note);

  const hasAnything =
    view.isAutoInquiry || view.plainNote.length > 0 || view.logs.length > 0;
  if (!hasAnything) return null;

  // 手入力の短いメモ（ログなし）は従来どおりそのまま表示
  if (!view.isAutoInquiry && view.logs.length === 0 && view.plainNote.length <= PLAIN_NOTE_INLINE_LIMIT) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
        {view.plainNote}
      </p>
    );
  }

  const summaryFields = SUMMARY_FIELD_LABELS.map((label) =>
    view.fields.find((field) => field.label === label)
  ).filter((field): field is { label: string; value: string } => Boolean(field));

  return (
    <div className="rounded-xl border border-pink-100 bg-pink-50/40">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-pink-50"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-pink-700">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {view.isAutoInquiry ? "依頼内容メモ" : "メモ"}
          {view.refImages.length > 0 ? (
            <span className="font-normal text-pink-600/80">画像{view.refImages.length}枚</span>
          ) : null}
          {view.logs.length > 0 ? (
            <span className="font-normal text-pink-600/80">履歴{view.logs.length}件</span>
          ) : null}
        </span>
        <span className="shrink-0 text-pink-400">
          {open ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </span>
      </button>

      {!open ? (
        <div className="px-3 pb-2.5">
          {view.isAutoInquiry ? (
            <dl className="space-y-0.5 text-xs leading-5 text-gray-700">
              {view.email ? (
                <div className="flex min-w-0 items-center gap-1">
                  <Mail className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
                  <dd className="truncate">{view.email}</dd>
                </div>
              ) : null}
              {summaryFields.map((field) => (
                <div key={field.label} className="flex min-w-0 gap-1">
                  <dt className="shrink-0 text-gray-500">{field.label}:</dt>
                  <dd className="truncate">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="line-clamp-2 break-words text-xs leading-5 text-gray-700">
              {view.plainNote}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 border-t border-pink-100 px-3 py-3">
          {view.email ? (
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-gray-700">
              <Mail className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
              <span className="break-all">{view.email}</span>
            </p>
          ) : null}

          {view.fields.length > 0 ? (
            <dl className="space-y-0.5 text-xs leading-5 text-gray-700">
              {view.fields.map((field) => (
                <div key={field.label} className="flex min-w-0 gap-1">
                  <dt className="shrink-0 text-gray-500">{field.label}:</dt>
                  <dd className="break-words">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {view.refImages.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {view.refImages.map((url, index) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" title="クリックで原寸表示">
                    {/* 依頼者がアップロードした公開バケット画像のプレビュー */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`添付画像 ${index + 1}`}
                      className="h-16 w-16 rounded-lg border border-pink-200 object-cover transition hover:opacity-80"
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {view.refText ? (
            <p className="whitespace-pre-wrap break-words text-xs leading-5 text-gray-700">
              {view.refText}
            </p>
          ) : null}

          {view.details ? (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-pink-700">
                ご依頼の詳細
              </p>
              <p className="whitespace-pre-wrap break-words rounded-lg border border-pink-100 bg-white p-2.5 text-xs leading-5 text-gray-900">
                {view.details}
              </p>
            </div>
          ) : null}
          {view.message ? (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-pink-700">
                その他・ご質問
              </p>
              <p className="whitespace-pre-wrap break-words rounded-lg border border-pink-100 bg-white p-2.5 text-xs leading-5 text-gray-900">
                {view.message}
              </p>
            </div>
          ) : null}

          {!view.isAutoInquiry && view.plainNote ? (
            <p className="whitespace-pre-wrap break-words text-xs leading-5 text-gray-700">
              {view.plainNote}
            </p>
          ) : null}

          {view.logs.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-pink-700">
                対応履歴
              </p>
              <ol className="space-y-1">
                {view.logs.map((log, index) => (
                  <li
                    key={`${log.dateISO}-${index}`}
                    className="rounded-lg border border-pink-100 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <p className="font-bold text-gray-900">
                      {formatLogDate(log.dateISO)}｜{log.label}
                    </p>
                    {log.body ? (
                      <p className="mt-0.5 whitespace-pre-wrap break-all leading-5 text-gray-600">
                        {log.body}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
