import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ConsultationRough } from "../types/consultation";

export type RoughRow = { id: string; message_id: string; before_quote: boolean; created_at: string; client_ok_at: string | null };
type Result<T> = PromiseLike<{ data: T; error: unknown }>;
/** natori_talk_roughs is newer than the generated Supabase types, so its table access is typed by hand. */
type RoughTable = {
  select(columns: string): {
    eq(column: string, value: string): {
      order(column: string, options: { ascending: boolean }): Result<RoughRow[] | null>;
      eq(column: string, value: string): { maybeSingle(): Result<RoughRow | null> };
    };
  };
  insert(row: { project_id: string; message_id: string; before_quote: boolean }): { select(columns: string): { maybeSingle(): Result<RoughRow | null> } };
  update(values: { client_ok_at: string }): { eq(column: string, value: string): { eq(column: string, value: string): { is(column: string, value: null): { select(columns: string): { maybeSingle(): Result<RoughRow | null> } } } } };
  delete(): { eq(column: string, value: string): { eq(column: string, value: string): { is(column: string, value: null): { select(columns: string): Result<{ id: string }[] | null> } } } };
};
export const roughs = () => (supabaseAdmin() as unknown as { from(table: "natori_talk_roughs"): RoughTable }).from("natori_talk_roughs");
export const ROUGH_COLUMNS = "id, message_id, before_quote, created_at, client_ok_at";

/** All roughs of a project, oldest first; null when the table cannot be read (it then simply adds nothing). */
export async function listProjectRoughs(projectId: string): Promise<RoughRow[] | null> {
  try {
    const { data, error } = await roughs().select(ROUGH_COLUMNS).eq("project_id", projectId).order("created_at", { ascending: true });
    if (error) return null;
    return data ?? [];
  } catch { return null; }
}

export function toConsultationRough(row: RoughRow): ConsultationRough {
  return { id: row.id, beforeQuote: row.before_quote, okAt: row.client_ok_at };
}

