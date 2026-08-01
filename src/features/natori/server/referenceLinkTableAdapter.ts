import "server-only";

// features/natori/server/referenceLinkTableAdapter.ts
// natori_project_reference_links への唯一のアクセス経路。
//
// TODO(P1-11): 生成済み Database 型に natori_project_reference_links が
// 含まれていないため、ここ1か所だけ narrow な cast を置き、外へは runtime
// 検証済みの型付き関数だけを公開する。P1-11 で型を再生成したらこの adapter の
// cast を外す。P1-05 の intakeRpcAdapter と同じ方針で、workaround を
// service / route / component へ広げない。
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE = "natori_project_reference_links";

type QueryResult = { data: unknown; error: unknown };

type Chainable = PromiseLike<QueryResult> & {
  select(columns?: string): Chainable;
  eq(column: string, value: string | number): Chainable;
  order(column: string, options?: { ascending?: boolean }): Chainable;
  maybeSingle(): PromiseLike<QueryResult>;
};

type LinkTable = {
  select(columns?: string): Chainable;
  insert(values: Record<string, unknown>): Chainable;
  update(values: Record<string, unknown>): Chainable;
  delete(): Chainable;
};

function linkTable(): LinkTable {
  return (supabaseAdmin() as unknown as { from(table: string): LinkTable }).from(TABLE);
}

const linkRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  url: z.string(),
  normalized_url: z.string(),
  label: z.string().nullable(),
  provider: z.string().nullable(),
  sort_order: z.number().int(),
  created_at: z.string(),
});

const linkRowsSchema = z.array(linkRowSchema);

export type NatoriProjectReferenceLinkRow = z.infer<typeof linkRowSchema>;

export type ReferenceLinkQueryResult<T> = { kind: "ok"; value: T } | { kind: "db-error" };

/** unique 制約 (project_id, normalized_url) 違反かどうか。 */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "23505";
}

export async function selectProjectReferenceLinks(
  projectId: string
): Promise<ReferenceLinkQueryResult<NatoriProjectReferenceLinkRow[]>> {
  try {
    const { data, error } = await linkTable()
      .select("id, project_id, url, normalized_url, label, provider, sort_order, created_at")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[natori-reference-links] select failed");
      return { kind: "db-error" };
    }
    const parsed = linkRowsSchema.safeParse(data ?? []);
    if (!parsed.success) {
      console.error("[natori-reference-links] unexpected row shape");
      return { kind: "db-error" };
    }
    return { kind: "ok", value: parsed.data };
  } catch {
    console.error("[natori-reference-links] select threw");
    return { kind: "db-error" };
  }
}

export type InsertProjectReferenceLinkInput = {
  projectId: string;
  url: string;
  normalizedUrl: string;
  label: string | null;
  sortOrder: number;
};

export type ReferenceLinkWriteResult =
  | { kind: "ok" }
  | { kind: "duplicate" }
  | { kind: "not-found" }
  | { kind: "db-error" };

export async function insertProjectReferenceLink(
  input: InsertProjectReferenceLinkInput
): Promise<ReferenceLinkWriteResult> {
  try {
    const { error } = await linkTable().insert({
      project_id: input.projectId,
      url: input.url,
      normalized_url: input.normalizedUrl,
      label: input.label,
      provider: null,
      sort_order: input.sortOrder,
    });
    if (error) {
      if (isUniqueViolation(error)) return { kind: "duplicate" };
      console.error("[natori-reference-links] insert failed");
      return { kind: "db-error" };
    }
    return { kind: "ok" };
  } catch {
    console.error("[natori-reference-links] insert threw");
    return { kind: "db-error" };
  }
}

/** project_id と id の両方で絞り、他 project の row を触らない。 */
export async function updateProjectReferenceLink(
  projectId: string,
  linkId: string,
  patch: Record<string, unknown>
): Promise<ReferenceLinkWriteResult> {
  try {
    const { data, error } = await linkTable()
      .update(patch)
      .eq("id", linkId)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();
    if (error) {
      if (isUniqueViolation(error)) return { kind: "duplicate" };
      console.error("[natori-reference-links] update failed");
      return { kind: "db-error" };
    }
    return data ? { kind: "ok" } : { kind: "not-found" };
  } catch {
    console.error("[natori-reference-links] update threw");
    return { kind: "db-error" };
  }
}

export async function deleteProjectReferenceLink(
  projectId: string,
  linkId: string
): Promise<ReferenceLinkWriteResult> {
  try {
    const { data, error } = await linkTable()
      .delete()
      .eq("id", linkId)
      .eq("project_id", projectId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[natori-reference-links] delete failed");
      return { kind: "db-error" };
    }
    return data ? { kind: "ok" } : { kind: "not-found" };
  } catch {
    console.error("[natori-reference-links] delete threw");
    return { kind: "db-error" };
  }
}

/** 複数 project の link をまとめて読む（一覧表示用）。 */
export async function selectReferenceLinksForProjects(
  projectIds: string[]
): Promise<ReferenceLinkQueryResult<NatoriProjectReferenceLinkRow[]>> {
  if (projectIds.length === 0) return { kind: "ok", value: [] };
  try {
    const table = supabaseAdmin() as unknown as {
      from(table: string): {
        select(columns: string): {
          in(column: string, values: string[]): PromiseLike<QueryResult>;
        };
      };
    };
    const { data, error } = await table
      .from(TABLE)
      .select("id, project_id, url, normalized_url, label, provider, sort_order, created_at")
      .in("project_id", projectIds);
    if (error) {
      console.error("[natori-reference-links] bulk select failed");
      return { kind: "db-error" };
    }
    const parsed = linkRowsSchema.safeParse(data ?? []);
    if (!parsed.success) {
      console.error("[natori-reference-links] unexpected bulk row shape");
      return { kind: "db-error" };
    }
    return { kind: "ok", value: parsed.data };
  } catch {
    console.error("[natori-reference-links] bulk select threw");
    return { kind: "db-error" };
  }
}
