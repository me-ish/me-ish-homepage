import NatoriDashboardLegacy from "@/features/natori/components/dashboard/NatoriDashboardLegacy";
import { caseDashboardSystemMode } from "@/features/natori/server/caseDashboardPreview";
import { CaseWorkspaceEntryPage, type CaseEntrySearch } from "@/features/natori/components/caseWorkspace/CaseWorkspaceEntryPage";

export const dynamic="force-dynamic";
/** Existing dashboard layout still requires the normal staff/shared-key access. */
export default async function NatoriDashboardPage({searchParams}:{searchParams:Promise<CaseEntrySearch>}) {
  const mode=await caseDashboardSystemMode();
  if(mode==="off")return <NatoriDashboardLegacy/>;
  return <CaseWorkspaceEntryPage input={await searchParams} preview readOnly={mode==="read-only"}/>;
}
