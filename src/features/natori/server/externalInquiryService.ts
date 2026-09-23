import "server-only";

import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function createExternalNatoriInquiry(input: {
  clientName: string; title: string; clientEmail: string; source: string; note: string;
}): Promise<{ kind: "ok"; projectId: string } | { kind: "no-owner" | "db-error" }> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "no-owner" };
  const { data, error } = await supabaseAdmin().from("natori_projects").insert({
    user_id: ownerId,
    client_name: input.clientName,
    title: input.title,
    client_email: input.clientEmail || null,
    type: "undecided",
    status: "inquiry",
    amount: null,
    due_date: null,
    next_action: "相談内容を確認する",
    note: `相談の入口: ${input.source}${input.note ? `\n\n最初の相談メモ:\n${input.note}` : ""}`,
  }).select("id").single();
  if (error || !data) {
    console.error("[natori-external-inquiry] insert failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", projectId: data.id };
}
