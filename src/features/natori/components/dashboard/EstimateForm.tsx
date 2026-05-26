"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Calculator, CheckCircle2, ChevronDown, ChevronUp, Clipboard, RotateCcw, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createDefaultNatoriPricingConfig, createNatoriEstimate, formatYen } from "@/features/natori/lib/pricing";
import {
  DEFAULT_NATORI_DELIVERY_PLAN,
  NATORI_DELIVERY_PLANS,
  NATORI_DELIVERY_PLAN_ORDER,
  calculateDueDate,
} from "@/features/natori/lib/deliveryPlans";
import { toISODate } from "@/features/natori/lib/projects";
import {
  fetchOwnPricingPresets,
  seedDefaultPricingPresets,
  updatePricingPresetConfig,
  type NatoriPricingPreset,
} from "@/features/natori/data/supabasePricing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import ProjectRegisterForm from "@/features/natori/components/dashboard/ProjectRegisterForm";
import type {
  NatoriDeliveryPlan,
  NatoriProjectType,
} from "@/features/natori/types/projects";
import type {
  NatoriEstimateCategory,
  NatoriEstimateLineItem,
  NatoriEstimateResult,
  NatoriPricingConfig,
} from "@/features/natori/types/pricing";

const CATEGORY_TO_TYPE: Record<NatoriEstimateCategory, NatoriProjectType> = {
  bust_up: "icon",
  waist_up: "sd",
  full_body: "standing",
};

export default function EstimateForm() {
  const [requestText, setRequestText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [pricingConfig, setPricingConfig] = useState<NatoriPricingConfig>(() => createDefaultNatoriPricingConfig());
  const [copied, setCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [deliveryPlan, setDeliveryPlan] = useState<NatoriDeliveryPlan>(DEFAULT_NATORI_DELIVERY_PLAN);
  const [startDateISO, setStartDateISO] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [presets, setPresets] = useState<NatoriPricingPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetDirty, setPresetDirty] = useState(false);
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  const loadPresets = useCallback(async () => {
    try {
      let list = await fetchOwnPricingPresets();
      if (list.length === 0) {
        list = await seedDefaultPricingPresets();
      }
      setPresets(list);
      const initial = list.find((preset) => preset.isDefault) ?? list[0];
      if (initial) {
        setActivePresetId(initial.id);
        setPricingConfig(initial.config);
        setPresetDirty(false);
      }
    } catch (err) {
      console.error("[EstimateForm] preset load failed", err);
      setPresetError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setStartDateISO(toISODate(new Date()));
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setAuthed(true);
          await loadPresets();
        }
      } catch (err) {
        console.error("[EstimateForm] auth check failed", err);
      }
    })();
  }, [loadPresets]);

  const dueDateISO = useMemo(
    () => (startDateISO ? calculateDueDate(startDateISO, deliveryPlan) : ""),
    [startDateISO, deliveryPlan]
  );

  const estimate = useMemo(
    () =>
      submittedText.trim()
        ? createNatoriEstimate(submittedText, pricingConfig, { deliveryPlan })
        : null,
    [pricingConfig, submittedText, deliveryPlan]
  );

  useEffect(() => {
    setPricingOpen(window.matchMedia("(min-width: 640px)").matches);
  }, []);

  const handleSubmit = () => {
    const trimmed = requestText.trim();
    if (!trimmed) return;
    setSubmittedText(trimmed);
    setCopied(false);
    setSummaryCopied(false);
  };

  const handleSelectPreset = (preset: NatoriPricingPreset) => {
    setActivePresetId(preset.id);
    setPricingConfig(preset.config);
    setPresetDirty(false);
    setPresetError(null);
  };

  const handlePricingConfigChange = (next: NatoriPricingConfig) => {
    setPricingConfig(next);
    if (authed && activePresetId) {
      setPresetDirty(true);
    }
  };

  const handleSavePreset = async () => {
    if (!activePresetId) return;
    setPresetSaving(true);
    setPresetError(null);
    try {
      await updatePricingPresetConfig(activePresetId, pricingConfig);
      setPresets((current) =>
        current.map((preset) =>
          preset.id === activePresetId ? { ...preset, config: pricingConfig } : preset
        )
      );
      setPresetDirty(false);
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : String(err));
    } finally {
      setPresetSaving(false);
    }
  };

  const handleResetPreset = () => {
    const active = presets.find((preset) => preset.id === activePresetId);
    if (active) {
      setPricingConfig(active.config);
      setPresetDirty(false);
      setPresetError(null);
    } else {
      setPricingConfig(createDefaultNatoriPricingConfig());
    }
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
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6">
      <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gray-900 text-white">
            <Clipboard className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900">依頼文を貼り付け</h2>
            <p className="text-sm text-gray-600">貼る、確認する、返信文をコピーするための下書き画面です。</p>
          </div>
        </div>

        <Textarea
          value={requestText}
          onChange={(event) => setRequestText(event.target.value)}
          placeholder="依頼文をここに貼り付けてください。例: 立ち絵、表情差分、商用利用、背景あり、急ぎ..."
          className="mt-5 min-h-[360px] resize-y border-gray-200 bg-white text-base leading-7 text-gray-900 focus-visible:ring-gray-400 sm:min-h-[320px] lg:min-h-[280px]"
        />

        <DeliveryPlanPicker
          deliveryPlan={deliveryPlan}
          onChange={setDeliveryPlan}
          startDateISO={startDateISO}
          onChangeStartDate={setStartDateISO}
          dueDateISO={dueDateISO}
        />

        <div className="mt-4">
          <Button
            onClick={handleSubmit}
            disabled={!requestText.trim()}
            className="h-12 w-full rounded-full bg-pink-500 px-6 text-base text-white hover:bg-pink-600 sm:w-auto sm:text-sm"
          >
            <Calculator className="h-4 w-4" aria-hidden />
            見積もり作成
          </Button>
        </div>

        {authed && presets.length > 0 ? (
          <PresetSwitcher
            presets={presets}
            activePresetId={activePresetId}
            dirty={presetDirty}
            saving={presetSaving}
            error={presetError}
            onSelect={handleSelectPreset}
            onSave={handleSavePreset}
          />
        ) : null}

        <PricingTable
          pricingConfig={pricingConfig}
          open={pricingOpen}
          onChange={handlePricingConfigChange}
          onReset={handleResetPreset}
          onToggle={() => setPricingOpen((current) => !current)}
        />
      </section>

      <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        {!estimate ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 text-center sm:min-h-[420px] sm:px-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-gray-700 shadow-sm">
              <Calculator className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900">概算見積もりがここに表示されます</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-gray-600">
              料金内訳、注意点、確認事項、返信文のたたき台をまとめて確認できます。
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">概算合計</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <p className="break-words text-4xl font-black tracking-normal text-emerald-900 sm:text-5xl lg:text-4xl">
                  {formatYen(estimate.total)}
                </p>
                <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm">
                  {estimate.category.label}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-emerald-900/80">
                固定料金表から出した概算です。正式料金は詳細確認後に確定します。
              </p>
            </div>

            <ProjectRegisterForm
              mode="estimate"
              defaults={{
                title: `${estimate.category.label}の案件`,
                type: CATEGORY_TO_TYPE[estimate.category.id],
                amount: estimate.total,
                deliveryPlan,
                startDateISO,
                dueDateISO,
                note: buildProjectNoteFromEstimate(estimate),
              }}
              fixedAmount
              fixedDeliveryPlan
            />

            <ResultBlock
              title="コピー用まとめ"
              action={
                <Button
                  variant="outline"
                  onClick={handleCopySummary}
                  className="h-11 w-full rounded-full border-gray-300 bg-white px-4 text-sm text-gray-800 hover:bg-gray-50 sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
                >
                  {summaryCopied ? "コピー済み" : "コピー"}
                </Button>
              }
            >
              <pre className="max-w-full whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-7 text-gray-800 [overflow-wrap:anywhere]">
                {createEstimateSummary(estimate)}
              </pre>
            </ResultBlock>

            <ResultBlock title="拾った項目">
              <div className="flex flex-wrap gap-2">
                {estimate.detectedItems.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
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
              <ResultBlock title="注意が必要な項目">
                <ul className="space-y-2">
                  {estimate.warnings.map((warning) => (
                    <li key={warning} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{warning}</span>
                    </li>
                  ))}
                </ul>
              </ResultBlock>
            )}

            <ResultBlock title="確認事項">
              <ul className="space-y-2">
                {estimate.questions.map((question) => (
                  <li key={question} className="flex gap-2 text-sm leading-6 text-gray-800">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{question}</span>
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
                  className="h-11 w-full rounded-full border-gray-300 bg-white px-4 text-sm text-gray-800 hover:bg-gray-50 sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
                >
                  {copied ? "コピー済み" : "コピー"}
                </Button>
              }
            >
              <pre className="max-w-full whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-7 text-gray-800 [overflow-wrap:anywhere]">
                {estimate.replyDraft}
              </pre>
            </ResultBlock>
          </div>
        )}
      </section>
    </div>
  );
}

function PresetSwitcher({
  presets,
  activePresetId,
  dirty,
  saving,
  error,
  onSelect,
  onSave,
}: {
  presets: NatoriPricingPreset[];
  activePresetId: string | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onSelect: (preset: NatoriPricingPreset) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-pink-200 bg-pink-50/50 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-pink-900">料金プリセット</p>
          <p className="mt-0.5 text-xs text-pink-800/80">
            依頼元（つなぐ / VGen）ごとの料金表に切り替えられます。編集して「保存」を押すと自分のアカウントに残ります。
          </p>
        </div>
        {dirty ? (
          <Button
            onClick={() => void onSave()}
            disabled={saving}
            className="h-9 rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            {saving ? "保存中…" : "このプリセットを保存"}
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = preset.id === activePresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                active
                  ? "border-pink-500 bg-pink-500 text-white shadow"
                  : "border-pink-200 bg-white text-pink-800 hover:border-pink-400"
              )}
            >
              {preset.name}
              {active && dirty ? <span className="ml-1 text-[10px] opacity-80">（未保存）</span> : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DeliveryPlanPicker({
  deliveryPlan,
  onChange,
  startDateISO,
  onChangeStartDate,
  dueDateISO,
}: {
  deliveryPlan: NatoriDeliveryPlan;
  onChange: (next: NatoriDeliveryPlan) => void;
  startDateISO: string;
  onChangeStartDate: (next: string) => void;
  dueDateISO: string;
}) {
  const dueLabel = dueDateISO ? formatHumanDate(dueDateISO) : "";
  return (
    <div className="mt-5 rounded-2xl border border-pink-200 bg-pink-50/60 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-pink-500 text-white">
          <Zap className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-pink-900">納期プラン</p>
          <p className="text-xs text-pink-800/80">通常は約1ヶ月。お急ぎ納品を選ぶと見積もりへ追加料金が自動加算されます。</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {NATORI_DELIVERY_PLAN_ORDER.map((id) => {
          const meta = NATORI_DELIVERY_PLANS[id];
          const selected = id === deliveryPlan;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={selected}
              className={cn(
                "min-w-0 rounded-2xl border px-3 py-2 text-left transition",
                selected
                  ? cn(meta.chipClassName, "ring-2 ring-offset-1", meta.barAccentClassName)
                  : "border-pink-200 bg-white text-pink-900 hover:border-pink-300"
              )}
            >
              <p className="text-sm font-black leading-5">{meta.label}</p>
              <p className="mt-0.5 text-[11px] leading-4 opacity-80">
                {meta.description}・追加 {meta.extraFee > 0 ? `+${formatYen(meta.extraFee)}` : "なし"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-wide text-pink-700">開始日</span>
          <input
            type="date"
            value={startDateISO}
            onChange={(event) => onChangeStartDate(event.target.value)}
            className="h-9 rounded-md border border-pink-200 bg-white px-2 text-sm text-pink-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </label>
        <div className="flex flex-col gap-1 rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm">
          <span className="text-[11px] font-bold uppercase tracking-wide text-pink-700">納期目安（自動計算）</span>
          <span className="text-base font-black text-pink-900">{dueLabel || "—"}</span>
        </div>
      </div>
    </div>
  );
}

function formatHumanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function buildProjectNoteFromEstimate(estimate: NatoriEstimateResult): string {
  const lines: string[] = [];
  lines.push(`概算: ${formatYen(estimate.total)}（${estimate.category.label}）`);
  if (estimate.detectedItems.length > 0) {
    lines.push(
      `拾った項目: ${estimate.detectedItems.map((item) => item.label).join(" / ")}`
    );
  }
  if (estimate.warnings.length > 0) {
    lines.push(`注意: ${estimate.warnings.join(" / ")}`);
  }
  return lines.join("\n");
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
  open,
  onChange,
  onReset,
  onToggle,
}: {
  pricingConfig: NatoriPricingConfig;
  open: boolean;
  onChange: (next: NatoriPricingConfig) => void;
  onReset: () => void;
  onToggle: () => void;
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
    <div className="mt-6 min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">料金表</h3>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            この画面内だけで一時編集できます。変更後に見積もりを作成すると、編集後の金額で計算します。
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onToggle}
            aria-expanded={open}
            className="h-11 w-full rounded-full border-gray-300 bg-white px-4 text-sm text-gray-800 hover:bg-gray-100 sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
          >
            {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            {open ? "料金表を閉じる" : "料金表を表示"}
          </Button>
          {open ? (
            <Button
              variant="outline"
              onClick={onReset}
              className="h-11 w-full rounded-full border-gray-300 bg-white px-4 text-sm text-gray-800 hover:bg-gray-100 sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              初期値
            </Button>
          ) : null}
        </div>
      </div>

      {open ? (
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
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600">注意が必要な項目</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pricingConfig.warningRules.map((rule) => (
              <span
                key={rule.id}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
              >
                {rule.label}
              </span>
            ))}
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}

function EditablePriceGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{title}</p>
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
    <label className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="min-w-0 flex-1 truncate text-gray-800">{label}</span>
      <span className="flex w-full items-center gap-2 sm:w-auto">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-right text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 sm:h-8 sm:w-24 sm:flex-none sm:text-sm"
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
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{title}</p>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2">
              <span className="min-w-0 text-gray-800">
                {item.label}
                {item.note && <span className="ml-2 text-xs text-gray-500">{item.note}</span>}
              </span>
              <span className="shrink-0 text-base font-bold text-gray-900 sm:text-sm">{formatYen(item.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2 text-sm text-gray-500">{emptyText}</p>
      )}
      {footer && <p className="border-t border-gray-200 px-3 py-2 text-xs text-gray-500">{footer}</p>}
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
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
