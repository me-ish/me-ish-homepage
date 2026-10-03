import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { taskProjectionSchema, type NatoriTaskProjection } from "../lib/taskProjection";
import type { NatoriAdminProjectRow, NatoriAdminTaskRow } from "./projectsService";

const resultSchema = z.object({
  result: z.enum(["applied", "unchanged", "not_found", "invalid_request", "invalid_stage", "conflict"]),
  project: taskProjectionSchema.optional(),
});
export type NatoriTaskMutationResult =
  | { kind: "ok"; project: NatoriTaskProjection }
  | { kind: "conflict"; project: NatoriTaskProjection }
  | { kind: "not-found" | "db-error" };

export async function setTaskFromLatestDb(projectId: string, taskKey: string, done: boolean): Promise<NatoriTaskMutationResult> {
  const owner = await resolveNatoriOwnerId();
  if (!owner) return { kind: "not-found" };
  const { data, error } = await supabaseAdmin().rpc("natori_update_task_v1", {
    p_owner: owner, p_project: projectId, p_task_key: taskKey, p_done: done,
  });
  if (error) { console.error("[natori-tasks] transaction failed", error); return { kind: "db-error" }; }
  const parsed = resultSchema.safeParse(data);
  if (!parsed.success) { console.error("[natori-tasks] invalid transaction result"); return { kind: "db-error" }; }
  const result = parsed.data;
  if (result.result === "not_found") return { kind: "not-found" };
  if (result.result === "invalid_request") return { kind: "db-error" };
  if (!result.project || result.project.id !== projectId) return { kind: "db-error" };
  return result.result === "conflict" || result.result === "invalid_stage"
    ? { kind: "conflict", project: result.project } : { kind: "ok", project: result.project };
}

const snapshotSchema = z.object({
  projects: z.array(z.object({ id: z.uuid(), user_id: z.uuid(), status: z.string(),
    mutation_revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    deleted_at: z.string().nullable() }).passthrough()),
  tasks: z.array(z.object({ id: z.uuid(), project_id: z.uuid(), task_key: z.string(),
    label: z.string(), stage: z.string(), estimated_hours: z.number().nullable(), done: z.boolean(),
    sort_order: z.number().int() }).passthrough()),
});
export async function loadCoherentTaskSnapshot(owner: string, projectId?: string): Promise<{
  projects: NatoriAdminProjectRow[]; tasks: NatoriAdminTaskRow[];
} | null> {
  const { data, error } = await supabaseAdmin().rpc("natori_project_task_snapshot_v1", {
    p_owner: owner, p_project_ids: projectId ? [projectId] : undefined,
  });
  const parsed = snapshotSchema.safeParse(data);
  if (error || !parsed.success) { console.error("[natori-tasks] snapshot unavailable", error); return null; }
  const ids = new Set(parsed.data.projects.map(project => project.id));
  if (ids.size !== parsed.data.projects.length || parsed.data.projects.some(project => project.user_id !== owner || (projectId && project.id !== projectId)) ||
      parsed.data.tasks.some(task => !ids.has(task.project_id))) {
    console.error("[natori-tasks] snapshot scope mismatch"); return null;
  }
  // Existing administration row contract is retained. The RPC returns full owner
  // project rows; IDs/revision/tasks/lane fields are validated above.
  return { projects: parsed.data.projects as NatoriAdminProjectRow[], tasks: parsed.data.tasks };
}
