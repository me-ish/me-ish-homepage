import { createClient } from "@/lib/supabase/client";
import { createDefaultNatoriPricingConfig } from "@/features/natori/lib/pricing";
import type { NatoriPricingConfig } from "@/features/natori/types/pricing";

export type NatoriPricingPreset = {
  id: string;
  presetKey: string;
  name: string;
  config: NatoriPricingConfig;
  isDefault: boolean;
  sortOrder: number;
};

type PresetRow = {
  id: string;
  user_id: string;
  preset_key: string;
  name: string;
  config: unknown;
  is_default: boolean;
  sort_order: number;
};

const TABLE = "natori_pricing_configs";

export const DEFAULT_PRESET_SEEDS: Array<{ presetKey: string; name: string }> = [
  { presetKey: "tsunagu", name: "つなぐ用" },
  { presetKey: "vgen", name: "VGen用" },
];

const VISIBLE_PRESET_KEYS = new Set(DEFAULT_PRESET_SEEDS.map((seed) => seed.presetKey));

function rowToPreset(row: PresetRow): NatoriPricingPreset {
  return {
    id: row.id,
    presetKey: row.preset_key,
    name: row.name,
    config: row.config as NatoriPricingConfig,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
  };
}

export async function fetchOwnPricingPresets(): Promise<NatoriPricingPreset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .map((row) => rowToPreset(row as PresetRow))
    .filter((preset) => VISIBLE_PRESET_KEYS.has(preset.presetKey));
}

export async function seedDefaultPricingPresets(): Promise<NatoriPricingPreset[]> {
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("ログインが必要です。");

  const inserts = DEFAULT_PRESET_SEEDS.map((seed, index) => ({
    user_id: user.id,
    preset_key: seed.presetKey,
    name: seed.name,
    config: JSON.parse(JSON.stringify(createDefaultNatoriPricingConfig())),
    is_default: index === 0,
    sort_order: index,
  }));

  const { error } = await supabase
    .from(TABLE)
    .upsert(inserts, { onConflict: "user_id,preset_key", ignoreDuplicates: true });
  if (error) throw error;
  return fetchOwnPricingPresets();
}

export async function updatePricingPresetConfig(
  id: string,
  config: NatoriPricingConfig
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ config: JSON.parse(JSON.stringify(config)) })
    .eq("id", id);
  if (error) throw error;
}

export async function setDefaultPricingPreset(id: string): Promise<void> {
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("ログインが必要です。");

  // Clear existing default, then set the new one. Two separate updates so RLS
  // matches user_id without needing a stored function.
  const { error: clearErr } = await supabase
    .from(TABLE)
    .update({ is_default: false })
    .eq("user_id", user.id);
  if (clearErr) throw clearErr;

  const { error: setErr } = await supabase
    .from(TABLE)
    .update({ is_default: true })
    .eq("id", id);
  if (setErr) throw setErr;
}
