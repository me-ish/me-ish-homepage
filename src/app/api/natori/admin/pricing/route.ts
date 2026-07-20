import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  listNatoriAdminPresets,
  seedNatoriAdminPresets,
  setNatoriAdminDefaultPreset,
  updateNatoriAdminPresetConfig,
} from "@/features/natori/server/pricingService";
import {
  NATORI_OWNER_UNRESOLVED_MESSAGE,
  resolveNatoriActingUserId,
} from "@/features/natori/server/natoriOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function GET() {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveNatoriActingUserId();
  if (!userId) {
    return NextResponse.json({ presets: [] });
  }

  const result = await listNatoriAdminPresets(userId);
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 });
  }
  return NextResponse.json({ presets: result.presets });
}

/** デフォルトプリセットの投入（既に存在するキーはスキップ） */
export async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload) || !Array.isArray(payload.seeds)) {
    return NextResponse.json({ error: "seeds array is required" }, { status: 400 });
  }
  const seeds: Array<{
    presetKey: string;
    name: string;
    config: unknown;
    isDefault: boolean;
    sortOrder: number;
  }> = [];
  for (const raw of payload.seeds as unknown[]) {
    if (!isObject(raw)) {
      return NextResponse.json({ error: "Invalid seed entry" }, { status: 400 });
    }
    const presetKey = readString(raw.presetKey);
    const name = readString(raw.name);
    if (!presetKey || !name || !isObject(raw.config)) {
      return NextResponse.json({ error: "Invalid seed entry" }, { status: 400 });
    }
    seeds.push({
      presetKey,
      name,
      config: raw.config,
      isDefault: raw.isDefault === true,
      sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : seeds.length,
    });
  }

  const userId = await resolveNatoriActingUserId();
  if (!userId) {
    return NextResponse.json({ error: NATORI_OWNER_UNRESOLVED_MESSAGE }, { status: 500 });
  }

  const result = await seedNatoriAdminPresets(userId, seeds);
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to seed presets" }, { status: 500 });
  }

  const list = await listNatoriAdminPresets(userId);
  if (list.kind === "db-error") {
    return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 });
  }
  return NextResponse.json({ presets: list.presets });
}

export async function PATCH(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const id = readString(payload.id);
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (payload.kind === "config") {
    if (!isObject(payload.config)) {
      return NextResponse.json({ error: "config is required" }, { status: 400 });
    }
    const userId = await resolveNatoriActingUserId();
    if (!userId) {
      return NextResponse.json({ error: NATORI_OWNER_UNRESOLVED_MESSAGE }, { status: 500 });
    }
    const result = await updateNatoriAdminPresetConfig(userId, id, payload.config);
    if (result.kind === "db-error") {
      return NextResponse.json({ error: "Failed to update preset" }, { status: 500 });
    }
    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (payload.kind === "default") {
    const userId = await resolveNatoriActingUserId();
    if (!userId) {
      return NextResponse.json({ error: NATORI_OWNER_UNRESOLVED_MESSAGE }, { status: 500 });
    }
    const result = await setNatoriAdminDefaultPreset(userId, id);
    if (result.kind === "db-error") {
      return NextResponse.json({ error: "Failed to update preset" }, { status: 500 });
    }
    if (result.kind === "not-found") {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown update kind" }, { status: 400 });
}
