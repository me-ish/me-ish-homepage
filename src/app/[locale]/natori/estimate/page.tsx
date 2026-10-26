import type { Metadata } from "next";
import { natoriAdminViewport } from "@/features/natori/constants/adminViewport";
import EstimateWorkspace from "@/features/natori/components/dashboard/EstimateWorkspace";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";
import {caseDashboardSystemMode} from "@/features/natori/server/caseDashboardPreview";
import {CaseWorkspaceEntryPage,type CaseEntrySearch} from "@/features/natori/components/caseWorkspace/CaseWorkspaceEntryPage";

export const dynamic = "force-dynamic";

export const viewport = natoriAdminViewport;

export const metadata: Metadata = {
  title: "Natori Estimate | me-ish",
  description: "ナトリ先生の制作相談向けに、依頼文から概算見積もりと返信文のたたき台を作成する関係者向け内部ツールです。",
};

export default async function NatoriEstimatePage({searchParams}:{searchParams:Promise<CaseEntrySearch>}) {
  await requireNatoriAccess("/natori/estimate");
  const mode=await caseDashboardSystemMode();if(mode!=="off")return <CaseWorkspaceEntryPage input={await searchParams} entry="cases" source="estimate" preview readOnly={mode==="read-only"}/>;

  return (
    <NatoriPageShell current="estimate" title="見積もり">
      <EstimateWorkspace />
    </NatoriPageShell>
  );
}
