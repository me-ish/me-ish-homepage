"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import EstimateForm from "@/features/natori/components/dashboard/EstimateForm";
import StructuredEstimateSuggestionPanel from "@/features/natori/components/dashboard/StructuredEstimateSuggestionPanel";
import StructuredPricingEditor from "@/features/natori/components/dashboard/StructuredPricingEditor";
import StructuredQuoteIssuePanel from "@/features/natori/components/dashboard/StructuredQuoteIssuePanel";
import { fetchNatoriProjects } from "@/features/natori/data/supabaseProjects";
import {
  fetchOwnPricingPresets,
  seedDefaultPricingPresets,
} from "@/features/natori/data/supabasePricing";
import { resolveEstimateWorkspaceMode } from "@/features/natori/lib/estimateWorkspaceMode";
import { createDefaultNatoriPricingConfig } from "@/features/natori/lib/pricing";
import type { NatoriPricingConfigWithStructured } from "@/features/natori/lib/pricingSuggestionConfig";
import type { NatoriProject } from "@/features/natori/types/projects";

export default function EstimateWorkspace() {
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [project, setProject] = useState<NatoriProject | null>(null);
  const [pricingConfig, setPricingConfig] = useState<NatoriPricingConfigWithStructured>(() =>
    createDefaultNatoriPricingConfig()
  );
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activePresetName, setActivePresetName] = useState("料金プリセット");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("inquiry");
    setInquiryId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [projects, presetList] = await Promise.all([
          fetchNatoriProjects(),
          fetchOwnPricingPresets().then(async (list) =>
            list.length > 0 ? list : seedDefaultPricingPresets()
          ),
        ]);
        if (cancelled) return;
        setProject(projects.find((entry) => entry.id === id) ?? null);
        const activePreset = presetList.find((preset) => preset.isDefault) ?? presetList[0];
        if (activePreset) {
          setActivePresetId(activePreset.id);
          setActivePresetName(activePreset.name);
          setPricingConfig(activePreset.config);
        }
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          問い合わせを確認しています
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
          <div>
            <h2 className="font-bold text-red-900">問い合わせを読み込めませんでした</h2>
            <p className="mt-1 text-sm text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const mode = resolveEstimateWorkspaceMode({
    inquiryId,
    projectFound: Boolean(project),
    hasRequestData: Boolean(project?.requestData),
  });

  if (mode === "manual" || mode === "legacy") return <EstimateForm />;

  if (mode === "not-found" || !project) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-900">問い合わせが見つかりません</h2>
        <p className="mt-1 text-sm text-amber-800">
          削除済み、アーカイブ済み、またはアクセス対象外の可能性があります。
        </p>
        <Link href="/natori/estimate" className="mt-4 inline-flex rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900">
          通常の見積もり画面へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink-600">Structured inquiry</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-black text-gray-950">{project.title}</h1>
            <p className="mt-1 text-sm text-gray-600">{project.clientName}</p>
          </div>
          <Link href="/natori/dashboard" className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white px-4 text-xs font-bold text-gray-800 hover:bg-gray-50">
            問い合わせ管理へ戻る
          </Link>
        </div>
        <p className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm leading-6 text-violet-900">
          この案件は構造化された原回答を持つため、旧キーワード見積には渡しません。
          stable ID候補と確認項目を確定し、正式見積snapshotとして発行します。
        </p>
      </section>

      {activePresetId ? (
        <StructuredPricingEditor
          presetId={activePresetId}
          legacyConfig={pricingConfig}
          onSaved={setPricingConfig}
        />
      ) : null}

      <StructuredEstimateSuggestionPanel
        project={project}
        pricingConfig={pricingConfig}
        deliveryPlan={project.deliveryPlan ?? "normal"}
      />

      <StructuredQuoteIssuePanel
        project={project}
        pricingConfig={pricingConfig}
        pricingPresetId={activePresetId}
        pricingPresetName={activePresetName}
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm">
        発行すると依頼内容・料金明細・確認結果・メール本文がversion付きsnapshotとして固定されます。
        内容を変更する場合は、既存見積を上書きせず新しいversionを発行します。
      </section>
    </div>
  );
}
