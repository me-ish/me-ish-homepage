import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  closeNatoriProject,
  confirmNatoriProjectPayment,
  createNatoriAdminProject,
  deleteNatoriAdminProject,
  listNatoriAdminProjects,
  NATORI_PROJECT_STATUSES,
  patchNatoriProjectDetails,
  restoreNatoriAdminProject,
  setNatoriProjectStatus,
  setNatoriProjectTaskDone,
} from "@/features/natori/server/projectsService";
import {
  NATORI_OWNER_UNRESOLVED_MESSAGE,
  resolveNatoriActingUserId,
} from "@/features/natori/server/natoriOwner";
import type {
  NatoriConcreteProjectType,
  NatoriDeliveryPlan,
} from "@/features/natori/types/projects";

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

  const result = await listNatoriAdminProjects();
  switch (result.kind) {
    case "fetch-projects-error":
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    case "fetch-tasks-error":
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    case "ok":
      return NextResponse.json({
        projects: result.projects,
        archivedProjects: result.archivedProjects,
        tasks: result.tasks,
        referenceFiles: result.referenceFiles,
      });
  }
}

const NATORI_PROJECT_TYPES = new Set<string>(["icon", "sd", "standing", "illustration"]);
const NATORI_DELIVERY_PLANS = new Set<string>(["normal", "rush_14_days", "rush_7_days"]);

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
  const clientName = readString(payload.clientName);
  const type = readString(payload.type);
  if (!title || !clientName || !type || !NATORI_PROJECT_TYPES.has(type)) {
    return NextResponse.json(
      { error: "title, clientName and a valid type are required" },
      { status: 400 }
    );
  }

  const amountRaw = Number(payload.amount);
  const amount = Number.isFinite(amountRaw) ? Math.max(0, Math.round(amountRaw)) : 0;

  const status = readString(payload.status) ?? undefined;
  if (status && !NATORI_PROJECT_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const deliveryPlan = readString(payload.deliveryPlan) ?? undefined;
  if (deliveryPlan && !NATORI_DELIVERY_PLANS.has(deliveryPlan)) {
    return NextResponse.json({ error: "Invalid deliveryPlan" }, { status: 400 });
  }

  const userId = await resolveNatoriActingUserId();
  if (!userId) {
    return NextResponse.json({ error: NATORI_OWNER_UNRESOLVED_MESSAGE }, { status: 500 });
  }

  const result = await createNatoriAdminProject({
    userId,
    title,
    clientName,
    amount,
    type: type as NatoriConcreteProjectType,
    status,
    deliveryPlan: deliveryPlan as NatoriDeliveryPlan | undefined,
    startDateISO: readString(payload.startDateISO) ?? undefined,
    dueDateISO: readString(payload.dueDateISO) ?? undefined,
    nextAction: readString(payload.nextAction) ?? undefined,
    note: readString(payload.note) ?? undefined,
    priority: readString(payload.priority) ?? undefined,
  });
  if (result.kind === "db-error") {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
  return NextResponse.json({ projectId: result.projectId });
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

  const kind = payload.kind;
  const projectId = readString(payload.projectId);
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  if (kind === "task") {
    const taskKey = readString(payload.taskKey);
    const done = payload.done;
    const status = readString(payload.status);
    const nextAction = readString(payload.nextAction) ?? "";
    if (!taskKey || typeof done !== "boolean" || !status || !NATORI_PROJECT_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "taskKey, done and a valid status are required" },
        { status: 400 }
      );
    }
    const result = await setNatoriProjectTaskDone(
      projectId,
      taskKey,
      done,
      status,
      nextAction
    );
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
      case "invalid-transition":
        return NextResponse.json(
          { error: `Invalid status transition: ${result.from} -> ${result.to}` },
          { status: 409 }
        );
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

  if (kind === "close") {
    const reason = readString(payload.reason) ?? "";
    const result = await closeNatoriProject(projectId, reason);
    switch (result.kind) {
      case "db-error":
        return NextResponse.json({ error: "Failed to close project" }, { status: 500 });
      case "not-found":
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      case "invalid-transition":
        return NextResponse.json(
          { error: `Invalid status transition: ${result.from} -> ${result.to}` },
          { status: 409 }
        );
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
      case "invalid-transition":
        return NextResponse.json(
          { error: `Invalid status transition: ${result.from} -> ${result.to}` },
          { status: 409 }
        );
      case "ok":
        return NextResponse.json({ ok: true });
    }
  }

  if (kind === "restore") {
    const result = await restoreNatoriAdminProject(projectId);
    switch (result.kind) {
      case "db-error":
        return NextResponse.json({ error: "Failed to restore project" }, { status: 500 });
      case "not-found":
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      case "ok":
        return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Unknown update kind" }, { status: 400 });
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

  const result = await deleteNatoriAdminProject(id);
  switch (result.kind) {
    case "db-error":
      return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    case "not-found":
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    case "ok":
      return NextResponse.json({ ok: true });
  }
}
