import { notFound } from "next/navigation";
import { CaseWorkspaceEntryPage } from "@/features/natori/components/caseWorkspace/CaseWorkspaceEntryPage";
import { caseWorkspaceReadAvailable } from "@/features/natori/server/caseWorkspaceRead";
import { caseDashboardPreviewMode } from "@/features/natori/server/caseDashboardPreview";

export const dynamic = "force-dynamic";

/** Existing dashboard layout supplies the unchanged login/shared-key requirement. */
export default async function CaseWorkspacePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!caseWorkspaceReadAvailable()) notFound();
  return <CaseWorkspaceEntryPage input={await searchParams} readOnly={caseDashboardPreviewMode()==="read-only"}/>;
}
