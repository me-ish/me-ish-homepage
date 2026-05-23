import { createClient } from "@/lib/supabase/client";

export type NatoriEvent = {
  id: string;
  title: string;
  date: string;
  note?: string;
};

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  date: string;
  note: string | null;
};

const EVENTS_TABLE = "natori_events";

function rowToEvent(row: EventRow): NatoriEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    note: row.note ?? undefined,
  };
}

export async function fetchNatoriEvents(): Promise<NatoriEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => rowToEvent(row as EventRow));
}

export async function createNatoriEvent(input: {
  title: string;
  date: string;
  note?: string;
}): Promise<NatoriEvent> {
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("ログインが必要です。");

  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .insert({
      user_id: user.id,
      title: input.title,
      date: input.date,
      note: input.note ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToEvent(data as EventRow);
}

export async function updateNatoriEvent(
  id: string,
  input: { title?: string; date?: string; note?: string | null }
): Promise<void> {
  const supabase = createClient();
  const payload: { title?: string; date?: string; note?: string | null } = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.date !== undefined) payload.date = input.date;
  if (input.note !== undefined) payload.note = input.note;
  const { error } = await supabase.from(EVENTS_TABLE).update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteNatoriEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(EVENTS_TABLE).delete().eq("id", id);
  if (error) throw error;
}
