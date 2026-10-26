import "server-only";
import {assertServerAcceptanceTarget} from "@/lib/caseAcceptanceEnvironment";
import {acceptanceEventContext,acceptanceCreateFixture,sameEventContent} from "./caseAcceptanceEvents";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "@/features/natori/server/natoriOwner";

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
  const ownerId = await resolveNatoriOwnerId();
  const admin = supabaseAdmin();
  const query=admin.from(EVENTS_TABLE).select("*").eq("user_id",ownerId);
  if(assertServerAcceptanceTarget(true)){const config=await acceptanceEventContext();if(ownerId!==config.owner)return{kind:"db-error"};query.in("id",config.fixtures.map(f=>f.id));}
  const {data,error}=await query.order("date",{ascending:true});
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
  let fixtureId:string|undefined;
  if(assertServerAcceptanceTarget(true)){
    const config=await acceptanceEventContext(true),fixture=acceptanceCreateFixture(config,{title:input.title,date:input.date,note:input.note??null});
    if(input.userId!==config.owner||!fixture)return{kind:"db-error"};
    fixtureId=fixture.id;
    const prior=await admin.from(EVENTS_TABLE).select("*").eq("id",fixtureId).eq("user_id",config.owner).maybeSingle();
    if(prior.error)return{kind:"db-error"};
    if(prior.data)return prior.data.user_id===config.owner&&sameEventContent(prior.data,{title:input.title,date:input.date,note:input.note??null})?{kind:"ok",event:prior.data}:{kind:"db-error"};
  }
  const { data, error } = await admin
    .from(EVENTS_TABLE)
    .insert({
      ...(fixtureId?{id:fixtureId}:{}),
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
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "not-found" };
  if(assertServerAcceptanceTarget(true)){
    const c=await acceptanceEventContext(true);
    if(ownerId!==c.owner||!c.operations.includes("update")||!c.fixtures.some(f=>f.id===id)||(input.date&&(input.date<c.firstDate||input.date>c.lastDate)))return{kind:"not-found"};
  }
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
  const ownerId = await resolveNatoriOwnerId();
  if (!ownerId) return { kind: "not-found" };
  if(assertServerAcceptanceTarget(true)){
    const c=await acceptanceEventContext(true);if(ownerId!==c.owner||!c.operations.includes("delete")||!c.fixtures.some(f=>f.id===id))return{kind:"not-found"};
  }
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
