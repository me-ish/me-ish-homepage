import "server-only";

import { parseNatoriProjectActivityRow } from "@/features/natori/lib/projectActivity";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NatoriProjectActivity } from "@/features/natori/lib/projectActivity";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type ActivityQueryResult = {
  data: unknown[] | null;
  error: unknown;
};

type ActivityQueryBuilder = PromiseLike<ActivityQueryResult> & {
  eq(column: string, value: string): ActivityQueryBuilder;
  order(
    column: string,
    options: { ascending: boolean },
  ): ActivityQueryBuilder;
  limit(value: number): ActivityQueryBuilder;
};

type ActivityTableClient = {
  from(relation: "natori_project_activity"): {
    select(columns: string): ActivityQueryBuilder;
  };
};

export async function listNatoriProjectActivity(
  projectId: string,
  limit = DEFAULT_LIMIT,
): Promise<NatoriProjectActivity[] | null> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return null;

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
  const admin = supabaseAdmin();

  const { data: project, error: projectError } = await admin
    .from("natori_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (projectError) {
    console.error("[natori-project-activity] project lookup failed", projectError);
    return null;
  }
  if (!project) return null;

  // P1-11で生成型を一本化するまでの限定的な互換境界。
  // DB migrationは適用済みだが、既存の巨大な生成型へP1-10だけを手編集しない。
  const activityClient = admin as unknown as ActivityTableClient;
  const { data, error } = await activityClient
    .from("natori_project_activity")
    .select(
      "id, project_id, event_type, source_type, source_id, payload, occurred_at",
    )
    .eq("project_id", projectId)
    .eq("user_id", ownerId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[natori-project-activity] list failed", error);
    return null;
  }

  return (data ?? [])
    .map(parseNatoriProjectActivityRow)
    .filter((item): item is NatoriProjectActivity => item !== null);
}
