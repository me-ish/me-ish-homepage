"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createStructuredSuggestionConfigFromLegacy, withStructuredPricingConfig, type NatoriPricingConfigWithStructured } from "@/features/natori/lib/pricingSuggestionConfig";
import { updatePricingPresetConfig } from "@/features/natori/data/supabasePricing";
import type { NatoriPricingConfigV1 } from "@/features/natori/types/pricingSuggestion";

const BASES = [
  ["icon", "アイコン"],
  ["sd", "SD"],
  ["standing", "立ち絵"],
  ["illustration", "一枚絵"],
] as const;

type Props = {
  presetId: string;
  legacyConfig: NatoriPricingConfigWithStructured;
  onSaved: (next: NatoriPricingConfigWithStructured) => void;
};

export default function StructuredPricingEditor({ presetId, legacyConfig, onSaved }: Props) {
  const initial = useMemo(() => createStructuredSuggestionConfigFromLegacy(legacyConfig), [legacyConfig]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(BASES.map(([id]) => {
      const item = initial.items.find((entry) => entry.id === id && entry.kind === "base");
      return [id, item?.amount === undefined ? "" : String(item.amount)];
    }))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const complete = BASES.every(([id]) => values[id] !== "" && Number.isSafeInteger(Number(values[id])) && Number(values[id]) >= 0);

  const save = async () => {
    if (!complete) return;
    setSaving(true);
    setMessage(null);
    try {
      const baseIds = new Set<string>(BASES.map(([id]) => id));
      const config: NatoriPricingConfigV1 = {
        schemaVersion: 1,
        currency: "JPY",
        items: [
          ...BASES.map(([id, label]) => ({ id, kind: "base" as const, label, amount: Number(values[id]) })),
          ...initial.items.filter((item) => !baseIds.has(item.id)),
        ],
      };
      const next = withStructuredPricingConfig(legacyConfig, config);
      await updatePricingPresetConfig(presetId, next);
      onSaved(next);
      setMessage("商品別基本料金を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-pink-200 bg-pink-50/50 p-4 shadow-sm">
      <h2 className="text-sm font-black text-pink-950">商品別基本料金</h2>
      <p className="mt-1 text-xs leading-5 text-pink-800">
        structured見積の基本料金です。胸上・腰上・全身の料金とは別に保存し、既存料金表は変更しません。
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {BASES.map(([id, label]) => (
          <label key={id} className="rounded-xl border border-pink-200 bg-white p-3">
            <span className="text-xs font-bold text-gray-700">{label}</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={100}
                value={values[id]}
                onChange={(event) => setValues((current) => ({ ...current, [id]: event.target.value }))}
                className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-2 text-right font-bold"
                placeholder="未設定"
              />
              <span className="text-xs text-gray-500">円</span>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={!complete || saving} className="rounded-full bg-pink-500 text-white hover:bg-pink-600">
          <Save className="h-4 w-4" aria-hidden />
          {saving ? "保存中…" : "商品別料金を保存"}
        </Button>
        {!complete ? <p className="text-xs font-bold text-amber-700">4種類すべて入力してください。</p> : null}
        {message ? <p className="text-xs text-gray-700">{message}</p> : null}
      </div>
    </section>
  );
}
