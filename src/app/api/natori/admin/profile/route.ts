import { NextResponse } from "next/server";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  getNatoriAdminProfile,
  upsertNatoriAdminProfile,
} from "@/features/natori/server/profileService";
import {
  NATORI_OWNER_UNRESOLVED_MESSAGE,
  resolveNatoriActingUserId,
} from "@/features/natori/server/natoriOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function GET() {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveNatoriActingUserId();
  if (!userId) {
    // まだ誰のデータも無い＝プロフィール未作成として扱う
    return NextResponse.json({ profile: null });
  }

  const result = await getNatoriAdminProfile(userId);
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
  return NextResponse.json({ profile: result.profile });
}

export async function PUT(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let dailyCapacityHours: number | null = null;
  if (payload.dailyCapacityHours !== undefined && payload.dailyCapacityHours !== null) {
    const value = Number(payload.dailyCapacityHours);
    if (!Number.isFinite(value) || value < 0 || value > 24) {
      return NextResponse.json(
        { error: "dailyCapacityHours must be between 0 and 24" },
        { status: 400 }
      );
    }
    dailyCapacityHours = value;
  }

  const userId = await resolveNatoriActingUserId();
  if (!userId) {
    return NextResponse.json({ error: NATORI_OWNER_UNRESOLVED_MESSAGE }, { status: 500 });
  }

  const result = await upsertNatoriAdminProfile({
    userId,
    handle: readNullableString(payload.handle),
    displayName: readNullableString(payload.displayName),
    portfolioUrl: readNullableString(payload.portfolioUrl),
    linksUrl: readNullableString(payload.linksUrl),
    dailyCapacityHours,
  });
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
  return NextResponse.json({ profile: result.profile });
}
