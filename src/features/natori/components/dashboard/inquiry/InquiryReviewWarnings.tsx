"use client";

// 見積もり前に確定すべき項目のまとめ表示。
// 判定は lib/inquiryReviewWarnings.ts の presentation model に委ね、
// ここでは severity ごとの見せ方だけを持つ（P1-08 の pricing warning も
// 同じ型で合流できるようにする）。
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { NatoriReviewWarning } from "@/features/natori/lib/inquiryReviewWarnings";

export default function InquiryReviewWarnings({
  warnings,
}: {
  warnings: NatoriReviewWarning[];
}) {
  if (warnings.length === 0) {
    return (
      <section aria-labelledby="inquiry-review-heading">
        <h3
          id="inquiry-review-heading"
          className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700"
        >
          要確認事項
        </h3>
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          未確定の項目はありません。見積もりに進めます。
        </p>
      </section>
    );
  }

  const blockers = warnings.filter((warning) => warning.severity === "blocker");
  const attentions = warnings.filter((warning) => warning.severity === "attention");

  return (
    <section aria-labelledby="inquiry-review-heading">
      <h3
        id="inquiry-review-heading"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700"
      >
        要確認事項（{warnings.length}件）
      </h3>
      <ul className="space-y-2">
        {[...blockers, ...attentions].map((warning) => {
          const isBlocker = warning.severity === "blocker";
          return (
            <li
              key={warning.code}
              data-warning-code={warning.code}
              className={
                isBlocker
                  ? "rounded-xl border border-rose-200 bg-rose-50 p-3"
                  : "rounded-xl border border-amber-200 bg-amber-50 p-3"
              }
            >
              <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                {isBlocker ? (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-rose-600"
                    aria-hidden
                  />
                ) : (
                  <Info className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                )}
                <span className="sr-only">
                  {isBlocker ? "確定が必要:" : "確認が必要:"}
                </span>
                {warning.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-700">{warning.action}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
