import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";

export type NatoriAdminEventRow = {
  id: string;
  user_id: string;
  title: string;
  date: string;
  note: string | null;
};

const EVENTS_TABLE = "natori_events";

export type ListNatoriEventsResult =
  | { kind: "ok"; events: NatoriAdminEventRow[] }
  | { kind: "db-error" };

export async function listNatoriAdminEvents(): Promise<ListNatoriEventsResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "ok", events: [] };
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(EVENTS_TABLE)
    .select("*")
    .eq("user_id", ownerId)
    .order("date", { ascending: true });
  if (error) {
    console.error("[natori-admin-events] fetch failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", events: (data ?? []) as NatoriAdminEventRow[] };
}

export type CreateNatoriEventResult =
  | { kind: "ok"; event: NatoriAdminEventRow }
  | { kind: "db-error" };

export async function createNatoriAdminEvent(input: {
  userId: string;
  title: string;
  date: string;
  note?: string | null;
}): Promise<CreateNatoriEventResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(EVENTS_TABLE)
    .insert({
      user_id: input.userId,
      title: input.title,
      date: input.date,
      note: input.note ?? null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[natori-admin-events] insert failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", event: data as NatoriAdminEventRow };
}

export type NatoriEventMutationResult =
  | { kind: "ok" }
  | { kind: "not-found" }
  | { kind: "db-error" };

export async function updateNatoriAdminEvent(
  id: string,
  input: { title?: string; date?: string; note?: string | null }
): Promise<NatoriEventMutationResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.date !== undefined) payload.date = input.date;
  if (input.note !== undefined) payload.note = input.note;
  if (Object.keys(payload).length === 0) return { kind: "ok" };

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(EVENTS_TABLE)
    .update(payload)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-events] update failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

export async function deleteNatoriAdminEvent(id: string): Promise<NatoriEventMutationResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(EVENTS_TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-events] delete failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}
