import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriManagementContext } from "./natoriOwner";
import { caseContext, casePlanning } from "../lib/caseScreenContext";
import { signPortfolioReferenceImage } from "./portfolioSiteService";
import { referenceFileDisplayName } from "./projectsService";
import { z } from "zod";
export async function readCaseContext(projectId: string) {
  const { ownerId } = await resolveNatoriManagementContext();
  const { data, error } = await supabaseAdmin().rpc(
    "natori_case_context_read_v1",
    { p_owner: ownerId, p_project: projectId },
    { get: true },
  );
  if (error) throw Error("context_unavailable");
  if (!data) return null;
  const raw = caseContext
    .omit({ files: true, filesState: true })
    .extend({ files: z.array(z.object({ path: z.string() })) })
    .parse(data);
  if (raw.project.id !== projectId) throw Error("scope_mismatch");
  let filesState: "ready" | "unavailable" = "ready";
  const files = await Promise.all(
    raw.files.map(async (f, i) => {
      let url: string | null = null;
      try {
        url = await signPortfolioReferenceImage(f.path, 3600);
      } catch {
        filesState = "unavailable";
      }
      if (!url) filesState = "unavailable";
      return { name: referenceFileDisplayName(f.path, i), url };
    }),
  );
  return caseContext.parse({ ...raw, files, filesState });
}
export async function readCasePlanning() {
  const { ownerId } = await resolveNatoriManagementContext();
  const { data, error } = await supabaseAdmin().rpc(
    "natori_case_planning_read_v1",
    { p_owner: ownerId },
    { get: true },
  );
  if (error) throw Error("planning_unavailable");
  const rows = casePlanning.parse(data);
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw Error("duplicate_planning");
  return rows;
}
