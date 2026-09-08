"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import EstimateForm from "@/features/natori/components/dashboard/EstimateForm";
import StructuredEstimateSuggestionPanel from "@/features/natori/components/dashboard/StructuredEstimateSuggestionPanel";
import StructuredQuoteIssuePanel from "@/features/natori/components/dashboard/StructuredQuoteIssuePanel";
import { fetchNatoriProjects } from "@/features/natori/data/supabaseProjects";
import { resolveEstimateWorkspaceMode } from "@/features/natori/lib/estimateWorkspaceMode";
import { createPortfolioStructuredPricingConfig } from "@/features/natori/lib/portfolioPricing";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import type { NatoriProject } from "@/features/natori/types/projects";

const PRICING_SOURCE_NAME = "ポートフォリオ公開料金";

async function fetchPortfolioContent(): Promise<PortfolioContent> {
  const response = await fetch("/api/natori/portfolio/content", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`公開料金の読み込みに失敗しました (${response.status})`);
  }
  const payload = (await response.json()) as { content?: PortfolioContent };
  if (!payload.content) throw new Error("公開料金を読み込めませんでした");
  return payload.content;
}

export default function EstimateWorkspace() {
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [project, setProject] = useState<NatoriProject | null>(null);
  const [portfolioContent, setPortfolioContent] = useState<PortfolioContent | null>(null);
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
        const [projects, content] = await Promise.all([
          fetchNatoriProjects(),
          fetchPortfolioContent(),
        ]);
        if (cancelled) return;
        setProject(projects.find((entry) => entry.id === id) ?? null);
        setPortfolioContent(content);
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

  if (!portfolioContent) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-900">
        公開料金を読み込めないため、structured見積を作成できません。
      </div>
    );
  }

  const pricingConfig = createPortfolioStructuredPricingConfig(portfolioContent);

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
          公開ポートフォリオの料金とstable IDから候補を作り、確認後に正式見積snapshotとして発行します。
        </p>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950 shadow-sm">
        <p className="font-bold">料金ソース: {PRICING_SOURCE_NAME}</p>
        <p className="mt-1 text-xs text-sky-800">
          基本料金・追加オプションを変更する場合はポートフォリオ編集画面で変更してください。自サイトのstructured見積は同じ公開料金を直接参照します。
        </p>
        <Link href="/natori/portfolio/edit#section-plans" className="mt-2 inline-flex text-xs font-bold underline underline-offset-2">
          ポートフォリオ料金を編集する
        </Link>
      </section>

      <StructuredEstimateSuggestionPanel
        project={project}
        pricingConfig={pricingConfig}
        deliveryPlan={project.deliveryPlan ?? "normal"}
      />

      <StructuredQuoteIssuePanel
        key={project.id}
        project={project}
        pricingConfig={pricingConfig}
        pricingSourceName={PRICING_SOURCE_NAME}
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm">
        発行すると依頼内容・料金明細・確認結果・メール本文がversion付きsnapshotとして固定されます。
        内容を変更する場合は、既存見積を上書きせず新しいversionを発行します。
      </section>
    </div>
  );
}
