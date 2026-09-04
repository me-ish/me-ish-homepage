// src/lib/card/card.db.ts
import type { CardFormInput, CardDesign, CardContent } from "./card.schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";

export type CardRequestStatus = "draft" | "generated" | "error" | "published";

export const CURRENT_CARD_RENDERER_VERSION = "1.0.0" as const;

export type CardRequestRecord = {
  id: string;
  email: string;
  status: CardRequestStatus;
  publicSlug: string | null;
  publicId: string | null;
  visibility: string | null;
  publishedAt: string | null;
  payload: CardFormInput | null;
  design: CardDesign | null;
  content: CardContent | null;
  tier: string;
  paymentStatus: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  rendererVersion: string;
};

/* ---------------------------------------------------------
 * Slug helpers
 * --------------------------------------------------------- */

function normalizePublicSlug(input: string) {
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

async function uuidV4(): Promise<string> {
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  const mod = await import("crypto");
  return mod.randomUUID();
}

function mapDbToRecord(row: any): CardRequestRecord {
  return {
    id: String(row.id),
    email: row.email ?? "",
    status: row.status as CardRequestStatus,
    publicSlug: row.public_slug ?? null,
    publicId: row.public_id ?? null,
    visibility: row.visibility ?? null,
    publishedAt: row.published_at ?? null,
    payload: (row.payload ?? null) as CardFormInput | null,
    design: (row.design ?? null) as CardDesign | null,
    content: (row.content ?? null) as CardContent | null,
    tier: row.tier ?? "free",
    paymentStatus: row.payment_status ?? "unpaid",
    error: row.error ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    rendererVersion: row.renderer_version ?? "1.0.0",
  };
}

/* ---------------------------------------------------------
 * CRUD
 * --------------------------------------------------------- */

export async function insertCardDraft(data: {
  email: string;
  payload: Partial<CardFormInput>;
  sessionToken: string;
  tier?: string;
}): Promise<CardRequestRecord> {
  const supabase = supabaseAdmin();

  const { data: created, error } = await supabase
    .from("card_requests")
    .insert({
      status: "draft",
      email: data.email,
      payload: data.payload as unknown as Json,
      design: null,
      content: null,
      error: null,
      public_slug: null,
      tier: data.tier ?? "free",
      session_token: data.sessionToken,
    })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`insertCardDraft_failed:${error?.message ?? "unknown"}`);
  }

  return mapDbToRecord(created);
}

export async function updateCardGenerated(
  id: string,
  payload: { design: CardDesign; content: CardContent },
): Promise<CardRequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("card_requests")
    .update({
      status: "generated",
      design: payload.design as unknown as Json,
      content: payload.content as unknown as Json,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

export async function updateCardPayload(
  id: string,
  patch: Record<string, any>,
): Promise<void> {
  const supabase = supabaseAdmin();

  const { data: row, error: e1 } = await supabase
    .from("card_requests")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (e1) throw new Error(`payload_fetch_failed:${e1.message}`);

  const prev = (row?.payload as any) ?? {};
  const next = { ...prev, ...patch };

  const { error: e2 } = await supabase
    .from("card_requests")
    .update({
      payload: next as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (e2) throw new Error(`payload_update_failed:${e2.message}`);
}

export async function findCardRequest(
  id: string,
): Promise<CardRequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("card_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

export async function getCardByPublicId(
  publicId: string,
): Promise<CardRequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("card_requests")
    .select("*")
    .eq("public_id", publicId)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

export async function getCardByPublicSlug(
  slug: string,
): Promise<CardRequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("card_requests")
    .select("*")
    .eq("public_slug", slug)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

/* ---------------------------------------------------------
 * Publish
 * --------------------------------------------------------- */

async function pickUniquePublicSlug(
  supabase: any,
  base: string,
  excludeId: string,
): Promise<string> {
  const cleaned = normalizePublicSlug(base) || "card";

  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? cleaned : `${cleaned}-${i + 1}`;
    const { data: hit, error } = await supabase
      .from("card_requests")
      .select("id")
      .eq("public_slug", candidate)
      .neq("id", excludeId)
      .limit(1)
      .maybeSingle();

    if (error) continue;
    if (!hit) return candidate;
  }

  return `${cleaned}-${excludeId.slice(0, 6)}`;
}

export async function publishCard(
  id: string,
  content: CardContent,
): Promise<{
  record?: CardRequestRecord;
  publicId?: string;
  publicSlug?: string;
}> {
  const supabase = supabaseAdmin();

  const current = await findCardRequest(id);
  if (!current) return {};

  const baseName =
    current.payload?.name ?? "card";

  const publicId = current.publicId ?? (await uuidV4());
  const publicSlug =
    current.publicSlug ??
    (await pickUniquePublicSlug(supabase, baseName, id));

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("card_requests")
    .update({
      status: "published",
      public_slug: publicSlug,
      public_id: publicId,
      visibility: "public",
      published_at: nowIso,
      content: content as unknown as Json,
      error: null,
      updated_at: nowIso,
      renderer_version: CURRENT_CARD_RENDERER_VERSION,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) return {};

  const record = mapDbToRecord(data);
  return {
    record,
    publicId: record.publicId ?? undefined,
    publicSlug: record.publicSlug ?? undefined,
  };
}
