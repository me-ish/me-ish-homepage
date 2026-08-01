"use client";

// 原依頼内容（request_data）の field 単位表示。
// structured / legacy / 表示不能 の3系統は lib/inquiryRequestView.ts が判別し、
// ここは描画だけを持つ。raw JSON は表示しない。
import { FileWarning } from "lucide-react";
import type { NatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";

export default function InquiryRequestSummary({
  view,
}: {
  view: NatoriInquiryRequestView;
}) {
  if (view.kind === "legacy") return null;

  if (view.kind === "unsupported") {
    return (
      <section aria-labelledby="inquiry-request-heading">
        <h3
          id="inquiry-request-heading"
          className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700"
        >
          原依頼内容
        </h3>
        <p
          role="status"
          data-request-issue={view.issue}
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
        >
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {view.message}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="inquiry-request-heading">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3
          id="inquiry-request-heading"
          className="text-xs font-bold uppercase tracking-wide text-pink-700"
        >
          原依頼内容
        </h3>
        <span
          data-inquiry-mode={view.inquiryMode}
          className={
            view.inquiryMode === "quote"
              ? "inline-block rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700"
              : "inline-block rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700"
          }
        >
          {view.modeLabel}
        </span>
        <span className="text-[10px] text-gray-500">
          依頼者の原回答です（管理画面からは編集できません）
        </span>
      </div>

      <div className="space-y-3">
        {view.sections.map((section) => (
          <div
            key={section.key}
            className="rounded-xl border border-pink-100 bg-pink-50/40 p-3"
          >
            <p className="mb-1.5 text-[11px] font-bold text-pink-700">{section.title}</p>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key} className="flex min-w-0 gap-2">
                  <dt className="shrink-0 font-bold text-gray-600">{field.label}:</dt>
                  <dd
                    data-field={field.key}
                    className="min-w-0 whitespace-pre-wrap break-words text-gray-900"
                  >
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
