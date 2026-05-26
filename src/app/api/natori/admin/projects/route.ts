import { NextResponse } from "next/server";
import { canAccessNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  confirmNatoriProjectPayment,
  listNatoriAdminProjects,
  NATORI_PROJECT_STATUSES,
  patchNatoriProjectDetails,
  setNatoriProjectStatus,
  setNatoriProjectTaskDone,
} from "@/features/natori/server/projectsService";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function isNatoriManagementRequest(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return canAccessNatoriManagement(user?.email ?? null);
}

export async function GET() {
  if (!(await isNatoriManagementRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listNatoriAdminProjects();
  switch (result.kind) {
    case "fetch-projects-error":
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    case "fetch-tasks-error":
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    case "normalize-error":
      return NextResponse.json({ error: "Failed to normalize project tasks" }, { status: 500 });
    case "ok":
      return NextResponse.json({ projects: result.projects, tasks: result.tasks });
  }
}

export async function PATCH(request: Request) {
  if (!(await isNatoriManagementRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const kind = payload.kind;
  const projectId = readString(payload.projectId);
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  if (kind === "task") {
    const taskKey = readString(payload.taskKey);
    const done = payload.done;
    if (!taskKey || typeof done !== "boolean") {
      return NextResponse.json({ error: "taskKey and done are required" }, { status: 400 });
    }
    const result = await setNatoriProjectTaskDone(projectId, taskKey, done);
    switch (result.kind) {
      case "db-error":
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
      case "not-found":
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      case "ok":
        return NextResponse.json({ ok: true });
    }
  }

  if (kind === "project-status") {
    const status = readString(payload.status);
    const nextAction = readString(payload.nextAction) ?? "";
    if (!status || !NATORI_PROJECT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
    }
    const result = await setNatoriProjectStatus(projectId, status, nextAction);
    switch (result.kind) {
      case "db-error":
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
      case "not-found":
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      case "ok":
        return NextResponse.json({ ok: true });
    }
  }

  if (kind === "project-details") {
    const patch = isObject(payload.patch) ? payload.patch : null;
    if (!patch) {
      return NextResponse.json({ error: "patch is required" }, { status: 400 });
    }
    const result = await patchNatoriProjectDetails(projectId, patch);
    switch (result.kind) {
      case "no-editable-fields":
        return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
      case "db-error":
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
      case "not-found":
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      case "ok":
        return NextResponse.json({ ok: true });
    }
  }

  if (kind === "confirm-payment") {
    const nextAction = readString(payload.nextAction) ?? "ラフ作成";
    const result = await confirmNatoriProjectPayment(projectId, nextAction);
    switch (result.kind) {
      case "db-error":
        return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
      case "not-found":
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      case "ok":
        return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Unknown update kind" }, { status: 400 });
}
