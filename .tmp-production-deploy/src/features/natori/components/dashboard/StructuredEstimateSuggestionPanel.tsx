"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { createNatoriEstimateSuggestionV1 } from "@/features/natori/lib/pricingSuggestion";
import { createStructuredSuggestionConfigFromLegacy } from "@/features/natori/lib/pricingSuggestionConfig";
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import { formatYen } from "@/features/natori/lib/pricing";
import type { NatoriPricingConfig } from "@/features/natori/types/pricing";
import type { NatoriDeliveryPlan, NatoriProject } from "@/features/natori/types/projects";

export type StructuredEstimateSuggestionState = {
  structured: boolean;
  canIssueQuote: boolean;
  total: number | null;
};

type Props = {
  project: NatoriProject | null;
  pricingConfig: NatoriPricingConfig;
  deliveryPlan: NatoriDeliveryPlan;
  onStateChange?: (state: StructuredEstimateSuggestionState) => void;
};

export default function StructuredEstimateSuggestionPanel({
  project,
  pricingConfig,
  deliveryPlan,
  onStateChange,
}: Props) {
  const result = useMemo(() => {
    if (!project?.requestData) {
      return { kind: "legacy" as const };
    }

    const request = readNatoriRequestData(project.requestData);
    if (!request.success) {
      return { kind: "invalid" as const };
    }

    return {
      kind: "structured" as const,
      suggestion: createNatoriEstimateSuggestionV1({
        projectType: project.type,
        requestData: request.data,
        pricingConfig: createStructuredSuggestionConfigFromLegacy(pricingConfig),
        deliveryPlan,
      }),
    };
  }, [deliveryPlan, pricingConfig, project]);

  useEffect(() => {
    if (!onStateChange) return;
    if (result.kind === "legacy") {
      onStateChange({ structured: false, canIssueQuote: true, total: null });
      return;
    }
    if (result.kind === "invalid") {
      onStateChange({ structured: true, canIssueQuote: false, total: null });
      return;
    }
    onStateChange({
      structured: true,
      canIssueQuote: result.suggestion.canIssueQuote,
      total: result.suggestion.total,
    });
  }, [onStateChange, result]);

  if (result.kind === "legacy") return null;

  if (result.kind === "invalid") {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
          <div>
            <h3 className="font-bold text-red-900">構造化された依頼内容を読み取れません</h3>
            <p className="mt-1 text-sm leading-6 text-red-800">
              原依頼データを確認し、見積明細は手動で作成してください。正式見積の発行は停止します。
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { suggestion } = result;

  return (
    <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
          Stable ID 見積候補
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-lg font-black text-violet-950">構造化依頼からの自動候補</h3>
          <span className="text-2xl font-black text-violet-950">
            {formatYen(suggestion.total)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-violet-800">
          商品種別とstable IDだけを使用しています。自由記述や制作範囲から料金を推測しません。
        </p>
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-900">自動候補明細</h4>
        {suggestion.automaticItems.length > 0 ? (
          <ul className="mt-2 divide-y divide-violet-100 rounded-xl border border-violet-200 bg-white">
            {suggestion.automaticItems.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{item.labelSnapshot}</p>
                  <p className="text-xs text-gray-500">
                    {item.ruleId} / {item.sourceFields.join("・")}
                    {item.quantity > 1 ? ` / 数量 ${item.quantity}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-black text-gray-900">{formatYen(item.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm text-gray-600">
            自動採用できる明細はありません。
          </p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-bold text-gray-900">確認が必要な項目</h4>
        {suggestion.reviewItems.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {suggestion.reviewItems.map((item) => (
              <li
                key={`${item.code}:${item.ruleId}`}
                className={
                  item.severity === "blocker"
                    ? "rounded-xl border border-red-200 bg-red-50 px-3 py-3"
                    : "rounded-xl border border-amber-200 bg-amber-50 px-3 py-3"
                }
              >
                <div className="flex gap-2">
                  <AlertTriangle
                    className={
                      item.severity === "blocker"
                        ? "mt-0.5 h-4 w-4 shrink-0 text-red-700"
                        : "mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                    }
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-700">{item.action}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {item.sourceField} / {item.ruleId}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            自動候補を妨げる未確認項目はありません。
          </p>
        )}
      </div>

      <details className="rounded-xl border border-gray-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-bold text-gray-800">
          自動料金化しない入力
        </summary>
        <ul className="mt-2 space-y-2">
          {suggestion.ignoredFields.map((field) => (
            <li key={field.sourceField} className="flex gap-2 text-xs leading-5 text-gray-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <strong>{field.sourceField}</strong>：{field.reason}
              </span>
            </li>
          ))}
        </ul>
      </details>

      {!suggestion.canIssueQuote ? (
        <p className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-sm font-bold text-red-900">
          blockerが残っているため、正式見積は発行できません。
        </p>
      ) : null}
    </section>
  );
}
