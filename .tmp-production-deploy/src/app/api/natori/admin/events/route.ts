import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  createNatoriAdminEvent,
  deleteNatoriAdminEvent,
  listNatoriAdminEvents,
  updateNatoriAdminEvent,
} from "@/features/natori/server/eventsService";
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

  const result = await listNatoriAdminEvents();
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
  return NextResponse.json({ events: result.events });
}

export async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const title = readString(payload.title);
  const date = readString(payload.date);
  if (!title || !date) {
    return NextResponse.json({ error: "title and date are required" }, { status: 400 });
  }

  const userId = await resolveNatoriActingUserId();
  if (!userId) {
    return NextResponse.json({ error: NATORI_OWNER_UNRESOLVED_MESSAGE }, { status: 500 });
  }

  const result = await createNatoriAdminEvent({
    userId,
    title,
    date,
    note: readString(payload.note),
  });
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
  return NextResponse.json({ event: result.event });
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

  const input: { title?: string; date?: string; note?: string | null } = {};
  if (payload.title !== undefined) {
    const title = readString(payload.title);
    if (!title) return NextResponse.json({ error: "title must be non-empty" }, { status: 400 });
    input.title = title;
  }
  if (payload.date !== undefined) {
    const date = readString(payload.date);
    if (!date) return NextResponse.json({ error: "date must be non-empty" }, { status: 400 });
    input.date = date;
  }
  if (payload.note !== undefined) {
    input.note = payload.note === null ? null : readString(payload.note);
  }

  const result = await updateNatoriAdminEvent(id, input);
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const result = await deleteNatoriAdminEvent(id);
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
