import { withNatoriManagement } from "@/features/natori/server/natoriManagementRoute";
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  getNatoriAdminProfile,
  upsertNatoriAdminProfile,
} from "@/features/natori/server/profileService";
import {
  resolveNatoriOwnerId,
} from "@/features/natori/server/natoriOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export const GET = withNatoriManagement("profile.GET", false, async function GET() {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveNatoriOwnerId();

  const result = await getNatoriAdminProfile(userId);
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
  return NextResponse.json({ profile: result.profile }, { headers: { "Cache-Control": "no-store" } });
});

export const PUT = withNatoriManagement("profile.PUT", true, async function PUT(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!("expectedRevision" in payload) || (payload.expectedRevision !== null &&
      (typeof payload.expectedRevision !== "number" || !Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0))) {
    return NextResponse.json({ error: "expectedRevision is required" }, { status: 400 });
  }
  if (!isObject(payload.patch)) return NextResponse.json({ error: "patch is required" }, { status: 400 });
  const fields: Record<string, string> = { handle: "handle", displayName: "display_name", portfolioUrl: "portfolio_url", linksUrl: "links_url", dailyCapacityHours: "daily_capacity_hours" };
  const patch: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(payload.patch)) {
    if (!fields[key]) return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    if (key === "dailyCapacityHours") {
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 24)) return NextResponse.json({ error: "Invalid dailyCapacityHours" }, { status: 400 });
      patch[fields[key]] = value as number | null;
    } else {
      if (value !== null && typeof value !== "string") return NextResponse.json({ error: "Invalid field value" }, { status: 400 });
      patch[fields[key]] = readNullableString(value);
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No editable fields" }, { status: 400 });
  const userId = await resolveNatoriOwnerId();
  const result = await upsertNatoriAdminProfile({ userId, expectedRevision: payload.expectedRevision as number | null, patch });
  if (result.kind === "edit-conflict") return NextResponse.json({ error: "edit_conflict", code: "natori_edit_conflict" }, { status: 409 });
  if (result.kind === "invalid-request") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (result.kind === "db-error") return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  return NextResponse.json({ profile: result.profile }, { headers: { "Cache-Control": "no-store" } });
});
