"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import EstimateForm from "@/features/natori/components/dashboard/EstimateForm";
import EstimateJourney from "@/features/natori/components/dashboard/EstimateJourney";
import ExternalInquiryStarter from "@/features/natori/components/dashboard/ExternalInquiryStarter";
import { NatoriLoadError } from "@/features/natori/components/dashboard/NatoriLoadError";
import { fetchNatoriProjects } from "@/features/natori/data/supabaseProjects";
import { resolveEstimateWorkspaceMode } from "@/features/natori/lib/estimateWorkspaceMode";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import type { NatoriProject } from "@/features/natori/types/projects";

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
          fetchPortfolioContent().catch(() => null),
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
      <div className="space-y-3">
        <p role="status" className={natoriAdminUi.caption}>
          問い合わせを読み込んでいます
        </p>
        <NatoriSkeleton heightClassName="h-12" />
        <NatoriSkeleton heightClassName="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <NatoriLoadError
        resourceLabel="問い合わせ"
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const mode = resolveEstimateWorkspaceMode({
    inquiryId,
    projectFound: Boolean(project),
    hasRequestData: Boolean(project?.requestData),
  });

  if (mode === "manual") {
    return (
      <Tabs defaultValue="formal" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-2xl bg-zinc-200/60 p-1 sm:inline-flex sm:w-auto sm:rounded-full">
          <TabsTrigger
            value="formal"
            className="h-auto min-h-11 whitespace-normal rounded-xl px-4 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-[0_1px_3px_rgba(24,24,27,0.12)] sm:min-h-9 sm:rounded-full"
          >
            相談を登録して正式見積り
          </TabsTrigger>
          <TabsTrigger
            value="draft"
            className="h-auto min-h-11 whitespace-normal rounded-xl px-4 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-[0_1px_3px_rgba(24,24,27,0.12)] sm:min-h-9 sm:rounded-full"
          >
            依頼文から概算を出す（下書き）
          </TabsTrigger>
        </TabsList>
        <TabsContent value="formal" forceMount className="mt-0 data-[state=inactive]:hidden">
          <ExternalInquiryStarter />
        </TabsContent>
        <TabsContent value="draft" forceMount className="mt-0 data-[state=inactive]:hidden">
          <EstimateForm />
        </TabsContent>
      </Tabs>
    );
  }

  if (mode === "not-found" || !project) {
    return (
      <div className="rounded-2xl bg-amber-50 p-5 ring-1 ring-inset ring-amber-600/20">
        <h2 className="font-semibold text-amber-900">問い合わせが見つかりません</h2>
        <p className="mt-1 text-sm text-amber-800">
          削除済み、アーカイブ済み、またはアクセス対象外の可能性があります。
        </p>
        <Link href="/natori/estimate" className="mt-4 inline-flex rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900">
          通常の見積もり画面へ
        </Link>
      </div>
    );
  }

  return <EstimateJourney project={project} portfolioContent={portfolioContent} />;
}
