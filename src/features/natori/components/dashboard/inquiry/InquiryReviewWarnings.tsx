"use client";

// 見積もり前に確定すべき項目のまとめ表示。
// 判定は lib/inquiryReviewWarnings.ts の presentation model に委ね、
// ここでは severity ごとの見せ方だけを持つ（P1-08 の pricing warning も
// 同じ型で合流できるようにする）。
import { AlertTriangle, Info } from "lucide-react";
import type { NatoriReviewWarning } from "@/features/natori/lib/inquiryReviewWarnings";

export default function InquiryReviewWarnings({
  warnings,
}: {
  warnings: NatoriReviewWarning[];
}) {
  if (warnings.length === 0) return null;

  const blockers = warnings.filter((warning) => warning.severity === "blocker");
  const attentions = warnings.filter(
    (warning) => warning.severity === "attention",
  );

  return (
    <details className="group rounded-xl border border-amber-200 bg-amber-50/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-bold text-amber-950 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" aria-hidden />
          見積り前に確認すること {warnings.length}件
        </span>
        <span className="text-xs text-amber-800 group-open:hidden">
          詳細を見る ↓
        </span>
        <span className="hidden text-xs text-amber-800 group-open:inline">
          閉じる ↑
        </span>
      </summary>
      <ul className="space-y-2 border-t border-amber-200 p-3">
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
                  <Info
                    className="h-4 w-4 shrink-0 text-amber-600"
                    aria-hidden
                  />
                )}
                <span className="sr-only">
                  {isBlocker ? "確定が必要:" : "確認が必要:"}
                </span>
                {warning.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-700">
                {warning.action}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
