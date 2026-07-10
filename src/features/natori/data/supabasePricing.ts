// natori 見積もりプリセットのデータアクセス。
// 認可（合言葉キー / ログイン）はサーバー側 API に任せるため、
// ブラウザ Supabase ではなく /api/natori/admin/pricing を経由する。
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

const API_PATH = "/api/natori/admin/pricing";

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

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${fallback} (${response.status})`;
}

function toVisiblePresets(rows: PresetRow[]): NatoriPricingPreset[] {
  return rows.map(rowToPreset).filter((preset) => VISIBLE_PRESET_KEYS.has(preset.presetKey));
}

export async function fetchOwnPricingPresets(): Promise<NatoriPricingPreset[]> {
  const response = await fetch(API_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "プリセットの読み込みに失敗しました"));
  }
  const payload = (await response.json()) as { presets?: PresetRow[] };
  return toVisiblePresets(payload.presets ?? []);
}

export async function seedDefaultPricingPresets(): Promise<NatoriPricingPreset[]> {
  const seeds = DEFAULT_PRESET_SEEDS.map((seed, index) => ({
    presetKey: seed.presetKey,
    name: seed.name,
    config: JSON.parse(JSON.stringify(createDefaultNatoriPricingConfig())),
    isDefault: index === 0,
    sortOrder: index,
  }));
  const response = await fetch(API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seeds }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "プリセットの初期化に失敗しました"));
  }
  const payload = (await response.json()) as { presets?: PresetRow[] };
  return toVisiblePresets(payload.presets ?? []);
}

export async function updatePricingPresetConfig(
  id: string,
  config: NatoriPricingConfig
): Promise<void> {
  const response = await fetch(API_PATH, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "config", id, config }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "プリセットの保存に失敗しました"));
  }
}

export async function setDefaultPricingPreset(id: string): Promise<void> {
  const response = await fetch(API_PATH, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "default", id }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "プリセットの更新に失敗しました"));
  }
}
