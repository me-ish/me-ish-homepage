import "server-only";

import { estimateDraftSchema, type NatoriEstimateDraft, type NatoriEstimateDraftData } from "@/features/natori/lib/estimateDraft";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Result =
  | { kind: "ok"; draft: NatoriEstimateDraft | null }
  | { kind: "not-found" | "invalid-state" | "conflict" | "db-error" };

const editableStatuses = ["inquiry", "consulting", "estimating", "quoted"];
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getEstimateDraft(projectId: string): Promise<Result> {
  if (!idPattern.test(projectId)) return { kind: "not-found" };
  const userId = await resolveNatoriActingUserId();
  if (!userId) return { kind: "not-found" };
  const db = supabaseAdmin();
  const { data: project, error: projectError } = await db.from("natori_projects")
    .select("id, status, deleted_at").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (projectError) {
    console.error("[natori-estimate-draft] project read failed", projectError);
    return { kind: "db-error" };
  }
  if (!project || project.deleted_at) return { kind: "not-found" };
  if (!editableStatuses.includes(project.status)) return { kind: "invalid-state" };
  const { data, error } = await db.from("natori_estimate_drafts")
    .select("agreed_terms, items, revision").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[natori-estimate-draft] draft read failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "ok", draft: null };
  const parsed = estimateDraftSchema.safeParse({ agreedTerms: data.agreed_terms, items: data.items });
  if (!parsed.success || !Number.isSafeInteger(data.revision)) return { kind: "db-error" };
  return { kind: "ok", draft: { ...parsed.data, revision: data.revision } };
}

export async function saveEstimateDraft(projectId: string, expectedRevision: number, input: NatoriEstimateDraftData): Promise<Result> {
  const existing = await getEstimateDraft(projectId);
  if (existing.kind !== "ok") return existing;
  if ((existing.draft?.revision ?? 0) !== expectedRevision) return { kind: "conflict" };
  const userId = await resolveNatoriActingUserId();
  if (!userId) return { kind: "not-found" };
  const db = supabaseAdmin();
  const payload = { agreed_terms: input.agreedTerms, items: input.items, updated_at: new Date().toISOString() };
  if (expectedRevision === 0) {
    const { error } = await db.from("natori_estimate_drafts").insert({
      project_id: projectId, user_id: userId, revision: 1, ...payload,
    });
    if (error) return error.code === "23505" ? { kind: "conflict" } : { kind: "db-error" };
    return { kind: "ok", draft: { ...input, revision: 1 } };
  }
  const { data, error } = await db.from("natori_estimate_drafts")
    .update({ ...payload, revision: expectedRevision + 1 })
    .eq("project_id", projectId).eq("user_id", userId).eq("revision", expectedRevision)
    .select("revision").maybeSingle();
  if (error) {
    console.error("[natori-estimate-draft] draft write failed", error);
    return { kind: "db-error" };
  }
  return data ? { kind: "ok", draft: { ...input, revision: data.revision } } : { kind: "conflict" };
}
