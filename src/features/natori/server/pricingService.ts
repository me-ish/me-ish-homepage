import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Json } from "@/types/supabase";

export type NatoriAdminPresetRow = {
  id: string;
  user_id: string;
  preset_key: string;
  name: string;
  config: unknown;
  is_default: boolean;
  sort_order: number;
};

const TABLE = "natori_pricing_configs";

export type ListNatoriPresetsResult =
  | { kind: "ok"; presets: NatoriAdminPresetRow[] }
  | { kind: "db-error" };

export async function listNatoriAdminPresets(userId: string): Promise<ListNatoriPresetsResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[natori-admin-pricing] fetch failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", presets: (data ?? []) as NatoriAdminPresetRow[] };
}

export type SeedNatoriPresetsResult = { kind: "ok" } | { kind: "db-error" };

export async function seedNatoriAdminPresets(
  userId: string,
  seeds: Array<{ presetKey: string; name: string; config: unknown; isDefault: boolean; sortOrder: number }>
): Promise<SeedNatoriPresetsResult> {
  const admin = supabaseAdmin();
  const inserts = seeds.map((seed) => ({
    user_id: userId,
    preset_key: seed.presetKey,
    name: seed.name,
    // config はリクエストJSON由来なので JSON 直列化可能であることが保証されている
    config: seed.config as Json,
    is_default: seed.isDefault,
    sort_order: seed.sortOrder,
  }));
  const { error } = await admin
    .from(TABLE)
    .upsert(inserts, { onConflict: "user_id,preset_key", ignoreDuplicates: true });
  if (error) {
    console.error("[natori-admin-pricing] seed failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok" };
}

export type NatoriPresetMutationResult =
  | { kind: "ok" }
  | { kind: "not-found" }
  | { kind: "db-error" };

export async function updateNatoriAdminPresetConfig(
  id: string,
  config: unknown
): Promise<NatoriPresetMutationResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    // config はリクエストJSON由来なので JSON 直列化可能であることが保証されている
    .update({ config: config as Json })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-pricing] config update failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

export async function setNatoriAdminDefaultPreset(
  userId: string,
  id: string
): Promise<NatoriPresetMutationResult> {
  const admin = supabaseAdmin();
  const { error: clearErr } = await admin
    .from(TABLE)
    .update({ is_default: false })
    .eq("user_id", userId);
  if (clearErr) {
    console.error("[natori-admin-pricing] default clear failed", clearErr);
    return { kind: "db-error" };
  }

  const { data, error } = await admin
    .from(TABLE)
    .update({ is_default: true })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-pricing] default set failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}
