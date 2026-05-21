"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Calculator, CheckCircle2, Clipboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createDefaultNatoriPricingConfig, createNatoriEstimate, formatYen } from "@/lib/natori/pricing";
import type { NatoriEstimateLineItem, NatoriEstimateResult, NatoriPricingConfig } from "@/types/natori/pricing";

export default function EstimateForm() {
  const [requestText, setRequestText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [pricingConfig, setPricingConfig] = useState<NatoriPricingConfig>(() => createDefaultNatoriPricingConfig());
  const [copied, setCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  const estimate = useMemo(
    () => (submittedText.trim() ? createNatoriEstimate(submittedText, pricingConfig) : null),
    [pricingConfig, submittedText]
  );

  const handleSubmit = () => {
    const trimmed = requestText.trim();
    if (!trimmed) return;
    setSubmittedText(trimmed);
    setCopied(false);
    setSummaryCopied(false);
  };

  const handleCopy = async () => {
    if (!estimate) return;
    await navigator.clipboard.writeText(estimate.replyDraft);
    setCopied(true);
  };

  const handleCopySummary = async () => {
    if (!estimate) return;
    await navigator.clipboard.writeText(createEstimateSummary(estimate));
    setSummaryCopied(true);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-pink-100 bg-white/90 p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-pink-100 text-pink-600">
            <Clipboard className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-pink-950">依頼文を貼り付け</h2>
            <p className="text-sm text-pink-900/60">貼る、確認する、返信文をコピーするための下書き画面です。</p>
          </div>
        </div>

        <Textarea
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
          placeholder="依頼文をここに貼り付けてください。例: 立ち絵、表情差分、商用利用、背景あり、急ぎ..."
          className="mt-5 min-h-[280px] resize-y border-pink-100 bg-pink-50/30 text-base leading-7 focus-visible:ring-pink-300"
        />

        <div className="mt-4">
          <Button
            onClick={handleSubmit}
            disabled={!requestText.trim()}
            className="h-11 rounded-full bg-pink-500 px-6 text-white hover:bg-pink-600"
          >
            <Calculator className="h-4 w-4" aria-hidden />
            見積もり作成
          </Button>
        </div>

        <PricingTable
          pricingConfig={pricingConfig}
          onChange={setPricingConfig}
          onReset={() => setPricingConfig(createDefaultNatoriPricingConfig())}
        />
      </section>

      <section className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm md:p-6">
        {!estimate ? (
          <div className="flex min-h-[460px] flex-col items-center justify-center rounded-xl border border-dashed border-pink-200 bg-pink-50/40 px-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-pink-500 shadow-sm">
              <Calculator className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-bold text-pink-950">概算見積もりがここに表示されます</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-pink-900/60">
              料金内訳、注意点、確認事項、返信文のたたき台をまとめて確認できます。
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-white p-5">
              <p className="text-sm font-medium text-pink-700">概算合計</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <p className="text-4xl font-black tracking-normal text-pink-950">
                  {formatYen(estimate.total)}
                </p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-pink-700 shadow-sm">
                  {estimate.category.label}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-pink-900/60">
                固定料金表から出した概算です。正式料金は詳細確認後に確定します。
              </p>
            </div>

            <ResultBlock
              title="コピー用まとめ"
              action={
                <Button
                  variant="outline"
                  onClick={handleCopySummary}
                  className="h-8 rounded-full border-pink-200 bg-white px-3 text-xs text-pink-700 hover:bg-pink-50"
                >
                  {summaryCopied ? "コピー済み" : "コピー"}
                </Button>
              }
            >
              <pre className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-7 text-gray-800 ring-1 ring-pink-50">
                {createEstimateSummary(estimate)}
              </pre>
            </ResultBlock>

            <ResultBlock title="拾った項目">
              <div className="flex flex-wrap gap-2">
                {estimate.detectedItems.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-pink-50 px-3 py-1 text-sm font-medium text-pink-800"
                    title={`該当語: ${item.matchedKeywords.join(" / ") || "通常イラスト扱い"}`}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                項目: {estimate.detectedItems.map((item) => item.label).join(" / ")}
              </p>
            </ResultBlock>

            <ResultBlock title="内訳">
              <div className="space-y-3">
                <LineItemGroup title="基本料金" items={[estimate.breakdown.base]} />
                <LineItemGroup title="固定追加" items={estimate.breakdown.fixed} emptyText="固定追加は検出されていません。" />
                <LineItemGroup
                  title="割合追加"
                  items={estimate.breakdown.percentage}
                  emptyText="割合追加は検出されていません。"
                  footer={`割合追加の計算元: 基本料金 ${formatYen(estimate.breakdown.base.amount)}`}
                />
              </div>
            </ResultBlock>

            {estimate.warnings.length > 0 && (
              <ResultBlock title="warning">
                <ul className="space-y-2">
                  {estimate.warnings.map((warning) => (
                    <li key={warning} className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </ResultBlock>
            )}

            <ResultBlock title="確認事項">
              <ul className="space-y-2">
                {estimate.questions.map((question) => (
                  <li key={question} className="flex gap-2 text-sm leading-6 text-gray-700">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-pink-500" aria-hidden />
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </ResultBlock>

            <ResultBlock
              title="返信文たたき台"
              action={
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  className="h-8 rounded-full border-pink-200 bg-white px-3 text-xs text-pink-700 hover:bg-pink-50"
                >
                  {copied ? "コピー済み" : "コピー"}
                </Button>
              }
            >
              <pre className="whitespace-pre-wrap rounded-xl bg-pink-50/60 p-4 text-sm leading-7 text-gray-800">
                {estimate.replyDraft}
              </pre>
            </ResultBlock>
          </div>
        )}
      </section>
    </div>
  );
}

function createEstimateSummary(estimate: NatoriEstimateResult): string {
  const fixedText = estimate.breakdown.fixed.length > 0
    ? estimate.breakdown.fixed.map((item) => `・${item.label}: ${formatYen(item.amount)}`).join("\n")
    : "・なし";
  const percentageText = estimate.breakdown.percentage.length > 0
    ? estimate.breakdown.percentage
        .map((item) => `・${item.label}: ${formatYen(item.amount)}${item.note ? ` (${item.note})` : ""}`)
        .join("\n")
    : "・なし";
  const warningText = estimate.warnings.length > 0
    ? estimate.warnings.map((warning) => `・${warning}`).join("\n")
    : "・なし";

  return [
    "【概算見積もり】",
    `メニュー: ${estimate.category.label}`,
    `概算合計: ${formatYen(estimate.total)}`,
    "",
    "【内訳】",
    `基本料金: ${estimate.breakdown.base.label} ${formatYen(estimate.breakdown.base.amount)}`,
    "固定追加:",
    fixedText,
    `割合追加: ※計算元 基本料金 ${formatYen(estimate.breakdown.base.amount)}`,
    percentageText,
    "",
    "【注意点】",
    warningText,
    "",
    "【確認事項】",
    ...estimate.questions.slice(0, 6).map((question) => `・${question}`),
  ].join("\n");
}

function PricingTable({
  pricingConfig,
  onChange,
  onReset,
}: {
  pricingConfig: NatoriPricingConfig;
  onChange: (next: NatoriPricingConfig) => void;
  onReset: () => void;
}) {
  const updateBasePrice = (id: string, value: number) => {
    onChange({
      ...pricingConfig,
      baseItems: pricingConfig.baseItems.map((item) =>
        item.id === id ? { ...item, basePrice: Math.max(0, value) } : item
      ),
    });
  };

  const updateFixedAmount = (id: string, value: number) => {
    onChange({
      ...pricingConfig,
      fixedOptions: pricingConfig.fixedOptions.map((option) =>
        option.id === id ? { ...option, amount: Math.max(0, value) } : option
      ),
    });
  };

  const updatePercentageRate = (id: string, value: number) => {
    onChange({
      ...pricingConfig,
      percentageOptions: pricingConfig.percentageOptions.map((option) =>
        option.id === id ? { ...option, rate: Math.max(0, value) / 100 } : option
      ),
    });
  };

  return (
    <div className="mt-6 rounded-2xl border border-pink-100 bg-pink-50/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-pink-950">料金表</h3>
          <p className="mt-1 text-xs leading-5 text-pink-900/60">
            この画面内だけで一時編集できます。変更後に見積もりを作成すると、編集後の金額で計算します。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onReset}
          className="h-9 shrink-0 rounded-full border-pink-200 bg-white px-3 text-xs text-pink-700 hover:bg-pink-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          初期値
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <EditablePriceGroup title="基本料金">
          {pricingConfig.baseItems.map((item) => (
            <EditablePriceRow
              key={item.id}
              label={item.label}
              value={item.basePrice}
              suffix="円"
              onChange={(value) => updateBasePrice(item.id, value)}
            />
          ))}
        </EditablePriceGroup>

        <EditablePriceGroup title="固定追加">
          {pricingConfig.fixedOptions.map((option) => (
            <EditablePriceRow
              key={option.id}
              label={option.label}
              value={option.amount}
              suffix="円"
              onChange={(value) => updateFixedAmount(option.id, value)}
            />
          ))}
        </EditablePriceGroup>

        <EditablePriceGroup title="割合追加">
          {pricingConfig.percentageOptions.map((option) => (
            <EditablePriceRow
              key={option.id}
              label={option.label}
              value={Math.round(option.rate * 100)}
              suffix="%"
              onChange={(value) => updatePercentageRate(option.id, value)}
            />
          ))}
        </EditablePriceGroup>

        <div>
          <p className="text-xs font-bold text-pink-700">warning ルール</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pricingConfig.warningRules.map((rule) => (
              <span key={rule.id} className="rounded-full bg-white px-3 py-1 text-xs text-pink-800 shadow-sm">
                {rule.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditablePriceGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-pink-700">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function EditablePriceRow({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
      <span className="min-w-0 flex-1 truncate text-gray-700">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8 w-24 rounded-lg border border-pink-100 bg-white px-2 text-right text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-200"
        />
        <span className="w-5 text-xs text-gray-500">{suffix}</span>
      </span>
    </label>
  );
}

function LineItemGroup({
  title,
  items,
  emptyText,
  footer,
}: {
  title: string;
  items: readonly NatoriEstimateLineItem[];
  emptyText?: string;
  footer?: string;
}) {
  return (
    <div className="rounded-xl border border-pink-50 bg-white">
      <div className="flex items-center justify-between border-b border-pink-50 px-3 py-2">
        <p className="text-xs font-bold text-pink-700">{title}</p>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-pink-50">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
              <span className="text-gray-700">
                {item.label}
                {item.note && <span className="ml-2 text-xs text-gray-400">{item.note}</span>}
              </span>
              <span className="font-bold text-gray-900">{formatYen(item.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2 text-sm text-gray-400">{emptyText}</p>
      )}
      {footer && <p className="border-t border-pink-50 px-3 py-2 text-xs text-gray-500">{footer}</p>}
    </div>
  );
}

function ResultBlock({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-pink-950">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
