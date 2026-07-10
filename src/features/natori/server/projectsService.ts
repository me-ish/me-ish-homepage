import "server-only";
import { createTasksForType } from "@/features/natori/lib/projects";
import { calculateDueDate } from "@/features/natori/lib/deliveryPlans";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  NatoriDeliveryPlan,
  NatoriProjectTask,
  NatoriProjectType,
} from "@/features/natori/types/projects";

export type NatoriAdminProjectRow = {
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

export type NatoriAdminTaskRow = {
  id: string;
  project_id: string;
  task_key: string;
  label: string;
  stage: string;
  estimated_hours: number | null;
  done: boolean;
  sort_order: number;
};

export const NATORI_PROJECT_STATUSES: ReadonlySet<string> = new Set([
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

export const NATORI_PROJECT_DETAILS_ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  "client_name",
  "title",
  "type",
  "amount",
  "delivery_plan",
  "start_date",
  "due_date",
  "note",
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

function existingTaskDone(
  tasksByKey: Map<string, NatoriAdminTaskRow>,
  keys: string[]
): boolean {
  return keys.some((key) => tasksByKey.get(key)?.done === true);
}

function shouldTemplateTaskBeDone(
  project: NatoriAdminProjectRow,
  templateTask: NatoriProjectTask,
  tasksByKey: Map<string, NatoriAdminTaskRow>
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
  projects: NatoriAdminProjectRow[],
  tasks: NatoriAdminTaskRow[]
): Promise<NatoriAdminTaskRow[]> {
  const projectsToNormalize = projects.filter((project) =>
    isNormalizedProjectType(project.type)
  );
  if (projectsToNormalize.length === 0) return tasks;

  const tasksByProject = new Map<string, NatoriAdminTaskRow[]>();
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

  return (data ?? []) as NatoriAdminTaskRow[];
}

export type ListNatoriAdminProjectsResult =
  | {
      kind: "ok";
      projects: NatoriAdminProjectRow[];
      tasks: NatoriAdminTaskRow[];
    }
  | { kind: "fetch-projects-error" }
  | { kind: "fetch-tasks-error" }
  | { kind: "normalize-error" };

export async function listNatoriAdminProjects(): Promise<ListNatoriAdminProjectsResult> {
  const admin = supabaseAdmin();
  const [{ data: projects, error: projectError }, { data: tasks, error: taskError }] =
    await Promise.all([
      (admin as any).from("natori_projects").select("*").order("due_date", { ascending: true }),
      (admin as any).from("natori_project_tasks").select("*").order("sort_order", { ascending: true }),
    ]);

  if (projectError) {
    console.error("[natori-admin-projects] project fetch failed", projectError);
    return { kind: "fetch-projects-error" };
  }

  if (taskError) {
    console.error("[natori-admin-projects] task fetch failed", taskError);
    return { kind: "fetch-tasks-error" };
  }

  const projectRows = (projects ?? []) as NatoriAdminProjectRow[];
  const taskRows = (tasks ?? []) as NatoriAdminTaskRow[];

  try {
    const normalizedTasks = await normalizeProjectTasks(admin, projectRows, taskRows);
    return { kind: "ok", projects: projectRows, tasks: normalizedTasks };
  } catch {
    return { kind: "normalize-error" };
  }
}

export type CreateNatoriAdminProjectInput = {
  userId: string;
  title: string;
  clientName: string;
  amount: number;
  type: NatoriProjectType;
  status?: string;
  deliveryPlan?: NatoriDeliveryPlan;
  startDateISO?: string;
  dueDateISO?: string;
  nextAction?: string;
  note?: string;
  priority?: string;
};

export type CreateNatoriAdminProjectResult =
  | { kind: "ok"; projectId: string }
  | { kind: "db-error" };

/**
 * data/supabaseProjects.createNatoriProject のサーバー版。type に応じた
 * タスクテンプレートも一緒に生成する。呼び出し側（API route）が userId を
 * 解決してから渡すこと。
 */
export async function createNatoriAdminProject(
  input: CreateNatoriAdminProjectInput
): Promise<CreateNatoriAdminProjectResult> {
  const deliveryPlan = input.deliveryPlan ?? "normal";
  const startDateISO = input.startDateISO ?? new Date().toISOString().slice(0, 10);
  const dueDateISO = input.dueDateISO ?? calculateDueDate(startDateISO, deliveryPlan);
  const status = input.status ?? "inquiry";

  const admin = supabaseAdmin();
  const { data: insertedProject, error: projectErr } = await (admin as any)
    .from("natori_projects")
    .insert({
      user_id: input.userId,
      title: input.title,
      client_name: input.clientName,
      amount: input.amount,
      type: input.type,
      status,
      delivery_plan: deliveryPlan,
      priority: input.priority ?? null,
      start_date: startDateISO,
      due_date: dueDateISO,
      next_action: input.nextAction ?? "",
      note: input.note ?? null,
    })
    .select("id")
    .single();
  if (projectErr) {
    console.error("[natori-admin-projects] project insert failed", projectErr);
    return { kind: "db-error" };
  }
  const projectId = (insertedProject as { id: string }).id;

  const tasks = createTasksForType(input.type);
  const taskInserts = tasks.map((task, index) => ({
    project_id: projectId,
    task_key: task.id,
    label: task.label,
    stage: task.stage,
    estimated_hours: task.estimatedHours ?? null,
    done: task.done,
    sort_order: index,
  }));
  if (taskInserts.length > 0) {
    const { error: taskErr } = await (admin as any)
      .from("natori_project_tasks")
      .insert(taskInserts);
    if (taskErr) {
      console.error("[natori-admin-projects] task insert failed", taskErr);
      return { kind: "db-error" };
    }
  }

  return { kind: "ok", projectId };
}

export type NatoriProjectMutationResult =
  | { kind: "ok" }
  | { kind: "not-found" }
  | { kind: "db-error" };

export type PatchNatoriProjectDetailsResult =
  | NatoriProjectMutationResult
  | { kind: "no-editable-fields" };

export async function setNatoriProjectTaskDone(
  projectId: string,
  taskKey: string,
  done: boolean
): Promise<NatoriProjectMutationResult> {
  const admin = supabaseAdmin();
  const { data, error } = await (admin as any)
    .from("natori_project_tasks")
    .update({ done })
    .eq("project_id", projectId)
    .eq("task_key", taskKey)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[natori-admin-projects] task update failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

export async function setNatoriProjectStatus(
  projectId: string,
  status: string,
  nextAction: string
): Promise<NatoriProjectMutationResult> {
  const admin = supabaseAdmin();
  const { data, error } = await (admin as any)
    .from("natori_projects")
    .update({ status, next_action: nextAction })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[natori-admin-projects] project status update failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

/**
 * Generic editor for the project's basic info (依頼者名・タイトル・金額・納期
 * など). Status / next_action / payment_confirmed_at are stripped server-side
 * so this kind cannot be misused to skip the inquiry → … → rough flow.
 */
export async function patchNatoriProjectDetails(
  projectId: string,
  patch: Record<string, unknown>
): Promise<PatchNatoriProjectDetailsResult> {
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (NATORI_PROJECT_DETAILS_ALLOWED_FIELDS.has(key)) update[key] = value;
  }
  if (Object.keys(update).length === 0) {
    return { kind: "no-editable-fields" };
  }

  const admin = supabaseAdmin();
  const { data, error } = await (admin as any)
    .from("natori_projects")
    .update(update)
    .eq("id", projectId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[natori-admin-projects] details update failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

/**
 * 案件を（タスクごと）完全に削除する。実績ページの手入力ミス修正用。
 */
export async function deleteNatoriAdminProject(
  projectId: string
): Promise<NatoriProjectMutationResult> {
  const admin = supabaseAdmin();

  const { error: taskErr } = await (admin as any)
    .from("natori_project_tasks")
    .delete()
    .eq("project_id", projectId);
  if (taskErr) {
    console.error("[natori-admin-projects] task delete failed", taskErr);
    return { kind: "db-error" };
  }

  const { data, error } = await (admin as any)
    .from("natori_projects")
    .delete()
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-projects] project delete failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

/**
 * "入金確認してラフ開始" button: stamps payment_confirmed_at and advances
 * status to `rough` so the project starts pressuring the production
 * schedule. If the payment_confirmed_at column does not exist yet (older
 * backend), retry without it so the status change still goes through.
 */
export async function confirmNatoriProjectPayment(
  projectId: string,
  nextAction: string
): Promise<NatoriProjectMutationResult> {
  const admin = supabaseAdmin();
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
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}
