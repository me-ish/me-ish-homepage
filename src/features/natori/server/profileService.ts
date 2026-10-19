import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type NatoriAdminProfileRow = {
  mutation_revision: number;
  user_id: string;
  handle: string | null;
  display_name: string | null;
  portfolio_url: string | null;
  links_url: string | null;
  daily_capacity_hours: number | null;
};

const PROFILES_TABLE = "natori_user_profiles";

export type GetNatoriProfileResult =
  | { kind: "ok"; profile: NatoriAdminProfileRow | null }
  | { kind: "db-error" };

export async function getNatoriAdminProfile(userId: string): Promise<GetNatoriProfileResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(PROFILES_TABLE)
    .select("user_id,handle,display_name,portfolio_url,links_url,daily_capacity_hours,mutation_revision")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-profile] fetch failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", profile: (data ?? null) as NatoriAdminProfileRow | null };
}

export type UpsertNatoriProfileResult =
  | { kind: "ok"; profile: NatoriAdminProfileRow }
  | { kind: "db-error" } | { kind: "edit-conflict" } | { kind: "invalid-request" };

export async function upsertNatoriAdminProfile(input: {
  userId: string; expectedRevision: number | null; patch: Record<string, string | number | null>;
}): Promise<UpsertNatoriProfileResult> {
  const { data, error } = await supabaseAdmin().rpc("natori_edit_profile_v1", {
    p_owner: input.userId, p_expected_revision: input.expectedRevision, p_patch: input.patch,
  });
  if (error) { console.error("[natori-admin-profile] atomic edit failed", error); return { kind: "db-error" }; }
  const parsed = z.object({ result: z.string(), profile: z.object({ user_id: z.uuid(), mutation_revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), handle: z.string().nullable(), display_name: z.string().nullable(), portfolio_url: z.string().nullable(), links_url: z.string().nullable(), daily_capacity_hours: z.number().nullable() }).optional() }).safeParse(data);
  if (!parsed.success) return { kind: "db-error" };
  const result = parsed.data;
  if (result.result === "edit_conflict") return { kind: "edit-conflict" };
  if (result.result === "invalid_request") return { kind: "invalid-request" };
  if (result.result !== "applied" || !result.profile || result.profile.user_id !== input.userId) return { kind: "db-error" };
  return { kind: "ok", profile: result.profile };
}
