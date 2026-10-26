import type { Metadata } from "next";
import { natoriAdminViewport } from "@/features/natori/constants/adminViewport";
import PaymentAttentionPanel from "@/features/natori/components/dashboard/PaymentAttentionPanel";
import ProjectsBoard from "@/features/natori/components/dashboard/ProjectsBoard";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";
import { caseDashboardSystemMode } from "@/features/natori/server/caseDashboardPreview";
import { CaseWorkspaceEntryPage, type CaseEntrySearch } from "@/features/natori/components/caseWorkspace/CaseWorkspaceEntryPage";

export const dynamic = "force-dynamic";

export const viewport = natoriAdminViewport;

export const metadata: Metadata = {
  title: "Natori Projects | me-ish",
  description: "制作中の案件のカレンダーと一覧",
};

export default async function NatoriProjectsPage({searchParams}:{searchParams:Promise<CaseEntrySearch>}) {
  await requireNatoriAccess("/natori/projects");
  const mode=await caseDashboardSystemMode();
  if(mode!=="off")return <CaseWorkspaceEntryPage input={await searchParams} entry="cases" preview readOnly={mode==="read-only"}/>;

  return (
    <NatoriPageShell current="projects" title="案件">
      <PaymentAttentionPanel />
      <ProjectsBoard />
    </NatoriPageShell>
  );
}
