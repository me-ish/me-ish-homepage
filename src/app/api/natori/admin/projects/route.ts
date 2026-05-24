import { NextResponse } from "next/server";
import { createTasksForType } from "@/lib/natori/projects";
import { canAccessNatoriManagement } from "@/lib/natori/requireNatoriAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";
import type { NatoriProjectTask, NatoriProjectType } from "@/types/natori/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  client_name: string;
  amount: number;
  type: string;
  status: string;
  delivery_plan: string;
  priority: string | null;
  start_date: string | null;
  due_date: string;
  next_action: string;
  note: string | null;
};

type TaskRow = {
  id: string;
  project_id: string;
  task_key: string;
  label: string;
  stage: string;
  estimated_hours: number | null;
  done: boolean;
  sort_order: number;
};

const NATORI_PROJECT_STATUSES = new Set([
  "inquiry",
  "estimating",
  // `consulting` is the legacy "依頼受付" value; kept for back-compat with rows
  // inserted before the inquiry/estimating split (2026-05).
  "consulting",
  "quoted",
  "awaiting_payment",
  "rough",
  "lineart",
  "coloring",
  "waiting",
  "delivery_prep",
  "delivered",
  "completed",
]);

const NORMALIZED_PROJECT_TYPES = new Set<NatoriProjectType>([
  "icon",
  "sd",
  "standing",
  "illustration",
]);

function isNormalizedProjectType(type: string): type is NatoriProjectType {
  return NORMALIZED_PROJECT_TYPES.has(type as NatoriProjectType);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function existingTaskDone(
  tasksByKey: Map<string, TaskRow>,
  keys: string[]
): boolean {
  return keys.some((key) => tasksByKey.get(key)?.done === true);
}

function shouldTemplateTaskBeDone(
  project: ProjectRow,
  templateTask: NatoriProjectTask,
  tasksByKey: Map<string, TaskRow>
): boolean {
  switch (templateTask.id) {
    case "rough":
      return (
        existingTaskDone(tasksByKey, ["rough"]) ||
        ["lineart", "coloring", "waiting", "delivery_prep", "delivered", "completed"].includes(project.status)
      );
    case "rough-submit":
      return (
        existingTaskDone(tasksByKey, ["rough-submit"]) ||
        ["lineart", "coloring", "waiting", "delivery_prep", "delivered", "completed"].includes(project.status)
      );
    case "lineart":
      return (
        existingTaskDone(tasksByKey, ["lineart", "line"]) ||
        ["coloring", "waiting", "delivery_prep", "delivered", "completed"].includes(project.status)
      );
    case "color":
      return (
        existingTaskDone(tasksByKey, ["color", "coloring"]) ||
        ["waiting", "delivery_prep", "delivered", "completed"].includes(project.status)
      );
    case "review":
      return (
        existingTaskDone(tasksByKey, ["review", "finishing"]) ||
        ["delivery_prep", "delivered", "completed"].includes(project.status)
      );
    case "delivery":
      return (
        existingTaskDone(tasksByKey, ["delivery"]) ||
        ["delivered", "completed"].includes(project.status)
      );
    default:
      return templateTask.done;
  }
}

async function normalizeProjectTasks(
  admin: ReturnType<typeof supabaseAdmin>,
  projects: ProjectRow[],
  tasks: TaskRow[]
): Promise<TaskRow[]> {
  const projectsToNormalize = projects.filter((project) =>
    isNormalizedProjectType(project.type)
  );
  if (projectsToNormalize.length === 0) return tasks;

  const tasksByProject = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const list = tasksByProject.get(task.project_id) ?? [];
    list.push(task);
    tasksByProject.set(task.project_id, list);
  }

  const upserts: Array<{
    project_id: string;
    task_key: string;
    label: string;
    stage: string;
    estimated_hours: number | null;
    done: boolean;
    sort_order: number;
  }> = [];
  const deleteIds: string[] = [];

  for (const project of projectsToNormalize) {
    const templateTasks = createTasksForType(project.type as NatoriProjectType);
    const templateKeys = new Set(templateTasks.map((task) => task.id));
    const existingTasks = tasksByProject.get(project.id) ?? [];
    const tasksByKey = new Map(existingTasks.map((task) => [task.task_key, task]));

    templateTasks.forEach((templateTask, index) => {
      const existing = tasksByKey.get(templateTask.id);
      const desired = {
        project_id: project.id,
        task_key: templateTask.id,
        label: templateTask.label,
        stage: templateTask.stage,
        estimated_hours: templateTask.estimatedHours ?? null,
        done: shouldTemplateTaskBeDone(project, templateTask, tasksByKey),
        sort_order: index,
      };
      if (
        !existing ||
        existing.label !== desired.label ||
        existing.stage !== desired.stage ||
        existing.estimated_hours !== desired.estimated_hours ||
        existing.done !== desired.done ||
        existing.sort_order !== desired.sort_order
      ) {
        upserts.push(desired);
      }
    });

    for (const existing of existingTasks) {
      if (!templateKeys.has(existing.task_key)) {
        deleteIds.push(existing.id);
      }
    }
  }

  if (upserts.length === 0 && deleteIds.length === 0) return tasks;

  if (upserts.length > 0) {
    const { error } = await (admin as any)
      .from("natori_project_tasks")
      .upsert(upserts, { onConflict: "project_id,task_key" });
    if (error) {
      console.error("[natori-admin-projects] task normalization upsert failed", error);
      throw error;
    }
  }

  if (deleteIds.length > 0) {
    const { error } = await (admin as any)
      .from("natori_project_tasks")
      .delete()
      .in("id", deleteIds);
    if (error) {
      console.error("[natori-admin-projects] task normalization delete failed", error);
      throw error;
    }
  }

  const { data, error } = await (admin as any)
    .from("natori_project_tasks")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[natori-admin-projects] task normalization reload failed", error);
    throw error;
  }

  return (data ?? []) as TaskRow[];
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

  const admin = supabaseAdmin();
  const [{ data: projects, error: projectError }, { data: tasks, error: taskError }] =
    await Promise.all([
      (admin as any).from("natori_projects").select("*").order("due_date", { ascending: true }),
      (admin as any).from("natori_project_tasks").select("*").order("sort_order", { ascending: true }),
    ]);

  if (projectError) {
    console.error("[natori-admin-projects] project fetch failed", projectError);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }

  if (taskError) {
    console.error("[natori-admin-projects] task fetch failed", taskError);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  let normalizedTasks: TaskRow[];
  try {
    normalizedTasks = await normalizeProjectTasks(
      admin,
      (projects ?? []) as ProjectRow[],
      (tasks ?? []) as TaskRow[]
    );
  } catch {
    return NextResponse.json({ error: "Failed to normalize project tasks" }, { status: 500 });
  }

  return NextResponse.json({
    projects: (projects ?? []) as ProjectRow[],
    tasks: normalizedTasks,
  });
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

  const admin = supabaseAdmin();

  if (kind === "task") {
    const taskKey = readString(payload.taskKey);
    const done = payload.done;
    if (!taskKey || typeof done !== "boolean") {
      return NextResponse.json({ error: "taskKey and done are required" }, { status: 400 });
    }

    const { data, error } = await (admin as any)
      .from("natori_project_tasks")
      .update({ done })
      .eq("project_id", projectId)
      .eq("task_key", taskKey)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[natori-admin-projects] task update failed", error);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (kind === "project-status") {
    const status = readString(payload.status);
    const nextAction = readString(payload.nextAction) ?? "";
    if (!status || !NATORI_PROJECT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
    }

    const { data, error } = await (admin as any)
      .from("natori_projects")
      .update({ status, next_action: nextAction })
      .eq("id", projectId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[natori-admin-projects] project status update failed", error);
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  // Generic editor for the project's basic info (依頼者名・タイトル・金額・納期
  // など). Status / next_action / payment_confirmed_at are stripped server-side
  // so this kind cannot be misused to skip the inquiry → … → rough flow.
  if (kind === "project-details") {
    const patch = isObject(payload.patch) ? payload.patch : null;
    if (!patch) {
      return NextResponse.json({ error: "patch is required" }, { status: 400 });
    }

    const allowed = new Set([
      "client_name",
      "title",
      "type",
      "amount",
      "delivery_plan",
      "start_date",
      "due_date",
      "note",
    ]);
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (allowed.has(key)) update[key] = value;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
    }

    const { data, error } = await (admin as any)
      .from("natori_projects")
      .update(update)
      .eq("id", projectId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[natori-admin-projects] details update failed", error);
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  // "入金確認してラフ開始" button: stamps payment_confirmed_at and advances
  // status to `rough` so the project starts pressuring the production
  // schedule. If the payment_confirmed_at column does not exist yet (older
  // backend), retry without it so the status change still goes through.
  if (kind === "confirm-payment") {
    const nextAction = readString(payload.nextAction) ?? "ラフ作成";
    const baseUpdate = { status: "rough", next_action: nextAction } as Record<string, unknown>;
    const withTimestamp = { ...baseUpdate, payment_confirmed_at: new Date().toISOString() };

    let { data, error } = await (admin as any)
      .from("natori_projects")
      .update(withTimestamp)
      .eq("id", projectId)
      .select("id")
      .maybeSingle();

    if (error && /payment_confirmed_at/i.test(error.message ?? "")) {
      // Column missing — fall back to a plain status update.
      const retry = await (admin as any)
        .from("natori_projects")
        .update(baseUpdate)
        .eq("id", projectId)
        .select("id")
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[natori-admin-projects] confirm-payment failed", error);
      return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown update kind" }, { status: 400 });
}
