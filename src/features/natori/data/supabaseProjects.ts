import { createClient } from "@/lib/supabase/client";
import { mockNatoriProjects } from "@/features/natori/constants/mockProjects";
import type {
  NatoriDeliveryPlan,
  NatoriProject,
  NatoriProjectPriority,
  NatoriProjectStatus,
  NatoriProjectTask,
  NatoriProjectType,
  NatoriTaskStage,
} from "@/features/natori/types/projects";

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
  // Optional — added by 20260524_natori_project_flow.sql. Missing on older
  // backends; treat as undefined.
  payment_confirmed_at?: string | null;
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

const PROJECTS_TABLE = "natori_projects";
const TASKS_TABLE = "natori_project_tasks";

async function patchNatoriAdminProject(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/natori/admin/projects", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to update Natori project (${response.status})`);
  }
}

function rowToProject(row: ProjectRow, taskRows: TaskRow[]): NatoriProject {
  const tasks: NatoriProjectTask[] = taskRows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((task) => task.stage !== "material")
    .map((task) => ({
      id: task.task_key,
      label: task.label,
      stage: task.stage as NatoriTaskStage,
      done: task.done,
      estimatedHours: task.estimated_hours ?? undefined,
    }));
  return {
    id: row.id,
    title: row.title,
    clientName: row.client_name,
    amount: row.amount,
    type: row.type as NatoriProjectType,
    status: row.status as NatoriProjectStatus,
    deliveryPlan: row.delivery_plan as NatoriDeliveryPlan,
    priority: (row.priority ?? undefined) as NatoriProjectPriority | undefined,
    startDate: row.start_date ?? undefined,
    dueDate: row.due_date,
    nextAction: row.next_action,
    note: row.note ?? undefined,
    paymentConfirmedAt: row.payment_confirmed_at ?? undefined,
    tasks,
  };
}

export async function fetchNatoriProjects(): Promise<NatoriProject[]> {
  const response = await fetch("/api/natori/admin/projects", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Natori projects (${response.status})`);
  }

  const payload = (await response.json()) as {
    projects?: ProjectRow[];
    tasks?: TaskRow[];
  };

  const projectRows = payload.projects ?? [];
  const taskRows = payload.tasks ?? [];
  const tasksByProject = new Map<string, TaskRow[]>();
  for (const task of taskRows) {
    const list = tasksByProject.get(task.project_id) ?? [];
    list.push(task);
    tasksByProject.set(task.project_id, list);
  }
  return projectRows.map((row) => rowToProject(row, tasksByProject.get(row.id) ?? []));
}

export async function toggleNatoriTaskDone(
  projectId: string,
  taskKey: string,
  done: boolean
): Promise<void> {
  await patchNatoriAdminProject({
    kind: "task",
    projectId,
    taskKey,
    done,
  });
}

export async function updateNatoriProjectStatus(
  projectId: string,
  status: NatoriProjectStatus,
  nextAction: string
): Promise<void> {
  await patchNatoriAdminProject({
    kind: "project-status",
    projectId,
    status,
    nextAction,
  });
}

/**
 * Confirms payment for a project that is in `awaiting_payment`: stamps
 * `payment_confirmed_at` (if the column exists) and advances status to `rough`
 * so the project starts pressuring the calendar. Used by the
 * "入金確認してラフ開始" button on the dashboard.
 */
export async function confirmNatoriProjectPayment(
  projectId: string,
  nextAction: string
): Promise<void> {
  await patchNatoriAdminProject({
    kind: "confirm-payment",
    projectId,
    nextAction,
  });
}

/**
 * Patch payload for editing the basic info of an existing project. Status,
 * next_action, payment_confirmed_at, and any task data are intentionally
 * excluded: status moves through the dedicated progress / confirm-payment
 * actions, not this generic editor.
 */
export type UpdateNatoriProjectDetailsInput = {
  clientName?: string;
  title?: string;
  type?: NatoriProjectType;
  amount?: number;
  deliveryPlan?: NatoriDeliveryPlan;
  startDate?: string | null;
  dueDate?: string;
  note?: string | null;
};

export class NatoriProjectDetailsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NatoriProjectDetailsValidationError";
  }
}

const NATORI_PROJECT_TYPES: NatoriProjectType[] = ["icon", "sd", "standing", "illustration"];
const NATORI_DELIVERY_PLANS_VALUES: NatoriDeliveryPlan[] = [
  "normal",
  "rush_14_days",
  "rush_7_days",
];

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * Normalizes raw form input into the row-shaped patch that gets sent to the
 * API. Pure function so it can be unit-tested without Supabase or React.
 *
 * - Trims string fields, rejects empty client_name / title.
 * - Clamps amount to a non-negative integer.
 * - Drops fields the caller did not supply (so PATCH is sparse).
 * - Forbids status / next_action / payment_confirmed_at from ever appearing.
 */
export function normalizeNatoriProjectDetailsPatch(
  input: UpdateNatoriProjectDetailsInput
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.clientName !== undefined) {
    const trimmed = input.clientName.trim();
    if (!trimmed) throw new NatoriProjectDetailsValidationError("依頼者名は必須です。");
    patch.client_name = trimmed;
  }
  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (!trimmed) throw new NatoriProjectDetailsValidationError("案件タイトルは必須です。");
    patch.title = trimmed;
  }
  if (input.type !== undefined) {
    if (!NATORI_PROJECT_TYPES.includes(input.type)) {
      throw new NatoriProjectDetailsValidationError("案件タイプが不正です。");
    }
    patch.type = input.type;
  }
  if (input.amount !== undefined) {
    if (!Number.isFinite(input.amount) || input.amount < 0) {
      throw new NatoriProjectDetailsValidationError("金額は0以上の数値で指定してください。");
    }
    patch.amount = Math.round(input.amount);
  }
  if (input.deliveryPlan !== undefined) {
    if (!NATORI_DELIVERY_PLANS_VALUES.includes(input.deliveryPlan)) {
      throw new NatoriProjectDetailsValidationError("納期プランが不正です。");
    }
    patch.delivery_plan = input.deliveryPlan;
  }
  if (input.startDate !== undefined) {
    if (input.startDate === null || input.startDate === "") {
      patch.start_date = null;
    } else {
      if (!isValidISODate(input.startDate)) {
        throw new NatoriProjectDetailsValidationError("開始日が日付として不正です。");
      }
      patch.start_date = input.startDate;
    }
  }
  if (input.dueDate !== undefined) {
    if (!isValidISODate(input.dueDate)) {
      throw new NatoriProjectDetailsValidationError("納期が日付として不正です。");
    }
    patch.due_date = input.dueDate;
  }
  if (input.note !== undefined) {
    if (input.note === null) {
      patch.note = null;
    } else {
      const trimmed = input.note.trim();
      patch.note = trimmed ? trimmed : null;
    }
  }

  return patch;
}

export async function updateNatoriProjectDetails(
  projectId: string,
  input: UpdateNatoriProjectDetailsInput
): Promise<void> {
  const patch = normalizeNatoriProjectDetailsPatch(input);
  if (Object.keys(patch).length === 0) return;
  await patchNatoriAdminProject({
    kind: "project-details",
    projectId,
    patch,
  });
}

export type CreateNatoriProjectInput = {
  title: string;
  clientName: string;
  amount: number;
  type: NatoriProjectType;
  status?: NatoriProjectStatus;
  deliveryPlan?: NatoriDeliveryPlan;
  startDateISO?: string;
  dueDateISO?: string;
  nextAction?: string;
  note?: string;
  priority?: NatoriProjectPriority;
};

/**
 * Creates a project (with auto-generated tasks for the given type) via the
 * admin API. Returns the new project ID. Ownership resolution (signed-in user
 * or the existing data owner) happens server-side.
 */
export async function createNatoriProject(input: CreateNatoriProjectInput): Promise<string> {
  const response = await fetch("/api/natori/admin/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to create Natori project (${response.status})`);
  }
  const payload = (await response.json()) as { projectId: string };
  return payload.projectId;
}

/**
 * Deletes a project together with its tasks. Used by the results page to fix
 * manual-entry mistakes. Irreversible.
 */
export async function deleteNatoriProject(projectId: string): Promise<void> {
  const response = await fetch(
    `/api/natori/admin/projects?id=${encodeURIComponent(projectId)}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to delete Natori project (${response.status})`);
  }
}

/**
 * Seeds the current user's account with the mock project set. Skips if the
 * user already has projects. Returns the number of projects inserted.
 */
export async function seedNatoriDemoProjects(): Promise<number> {
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("ログインが必要です。");

  const { count, error: countErr } = await supabase
    .from(PROJECTS_TABLE)
    .select("id", { count: "exact", head: true });
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) return 0;

  const projectInserts = mockNatoriProjects.map((project) => ({
    user_id: user.id,
    title: project.title,
    client_name: project.clientName,
    amount: project.amount,
    type: project.type,
    status: project.status,
    delivery_plan: project.deliveryPlan ?? "normal",
    priority: project.priority ?? null,
    start_date: project.startDate ?? null,
    due_date: project.dueDate,
    next_action: project.nextAction,
    note: project.note ?? null,
  }));

  const { data: insertedProjects, error: projectErr } = await supabase
    .from(PROJECTS_TABLE)
    .insert(projectInserts)
    .select("id, title, client_name, due_date");
  if (projectErr) throw projectErr;

  // Pair each inserted row back to its mock by (title, due_date, client_name) — the
  // mock set is unique on that combination.
  const insertedRows = (insertedProjects ?? []) as Array<{
    id: string;
    title: string;
    client_name: string;
    due_date: string;
  }>;
  const taskInserts: Array<{
    project_id: string;
    task_key: string;
    label: string;
    stage: NatoriTaskStage;
    estimated_hours: number | null;
    done: boolean;
    sort_order: number;
  }> = [];
  for (const mock of mockNatoriProjects) {
    const match = insertedRows.find(
      (row) =>
        row.title === mock.title &&
        row.client_name === mock.clientName &&
        row.due_date === mock.dueDate
    );
    if (!match) continue;
    mock.tasks.forEach((task, index) => {
      taskInserts.push({
        project_id: match.id,
        task_key: task.id,
        label: task.label,
        stage: task.stage,
        estimated_hours: task.estimatedHours ?? null,
        done: task.done,
        sort_order: index,
      });
    });
  }

  if (taskInserts.length > 0) {
    const { error: taskErr } = await supabase.from(TASKS_TABLE).insert(taskInserts);
    if (taskErr) throw taskErr;
  }

  return insertedRows.length;
}
