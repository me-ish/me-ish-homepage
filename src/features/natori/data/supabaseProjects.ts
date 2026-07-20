import { CSRF_HEADERS } from "@/lib/auth/csrf";
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
  paid_at?: string | null;
  paid_amount?: number | null;
  completed_at?: string | null;
  // Optional — added by 20260717_natori_client_email_and_mail_logs.sql.
  client_email?: string | null;
  deleted_at?: string | null;
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

async function patchNatoriAdminProject(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/natori/admin/projects", {
    method: "PATCH",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to update Natori project (${response.status})`);
  }
}

function rowToProject(
  row: ProjectRow,
  taskRows: TaskRow[],
  referenceImageUrls: string[]
): NatoriProject {
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
    clientEmail: row.client_email ?? undefined,
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
    paidAt: row.paid_at ?? row.payment_confirmed_at ?? undefined,
    paidAmount: row.paid_amount ?? undefined,
    completedAt: row.completed_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    referenceImageUrls,
    tasks,
  };
}

export async function fetchNatoriProjectCollection(): Promise<{
  projects: NatoriProject[];
  archivedProjects: NatoriProject[];
}> {
  const response = await fetch("/api/natori/admin/projects", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Natori projects (${response.status})`);
  }

  const payload = (await response.json()) as {
    projects?: ProjectRow[];
    archivedProjects?: ProjectRow[];
    tasks?: TaskRow[];
    referenceFiles?: Array<{ project_id: string; url: string }>;
  };

  const projectRows = payload.projects ?? [];
  const taskRows = payload.tasks ?? [];
  const tasksByProject = new Map<string, TaskRow[]>();
  const referencesByProject = new Map<string, string[]>();
  for (const task of taskRows) {
    const list = tasksByProject.get(task.project_id) ?? [];
    list.push(task);
    tasksByProject.set(task.project_id, list);
  }
  for (const reference of payload.referenceFiles ?? []) {
    const list = referencesByProject.get(reference.project_id) ?? [];
    list.push(reference.url);
    referencesByProject.set(reference.project_id, list);
  }
  const mapRow = (row: ProjectRow) =>
    rowToProject(
      row,
      tasksByProject.get(row.id) ?? [],
      referencesByProject.get(row.id) ?? []
    );
  return {
    projects: projectRows.map(mapRow),
    archivedProjects: (payload.archivedProjects ?? []).map(mapRow),
  };
}

export async function fetchNatoriProjects(): Promise<NatoriProject[]> {
  return (await fetchNatoriProjectCollection()).projects;
}

export async function toggleNatoriTaskDone(
  projectId: string,
  taskKey: string,
  done: boolean,
  status: NatoriProjectStatus,
  nextAction: string
): Promise<void> {
  await patchNatoriAdminProject({
    kind: "task",
    projectId,
    taskKey,
    done,
    status,
    nextAction,
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
 * Closes an inquiry that didn't work out (見送り). The reason, if any, is
 * appended to the note server-side so the history survives. Reversible by
 * setting the status back (unlike delete).
 */
export async function closeNatoriProject(projectId: string, reason: string): Promise<void> {
  await patchNatoriAdminProject({
    kind: "close",
    projectId,
    reason,
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
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
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
 * Fetches the projectId → public URL map of result thumbnails.
 */
export async function fetchNatoriProjectThumbs(): Promise<Record<string, string>> {
  const response = await fetch("/api/natori/admin/project-thumbs", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch thumbnails (${response.status})`);
  }
  const payload = (await response.json()) as { thumbs?: Record<string, string> };
  return payload.thumbs ?? {};
}

/**
 * Uploads (or replaces) the thumbnail image for a project. Returns the new
 * public URL (already cache-busted).
 */
export async function uploadNatoriProjectThumb(projectId: string, file: File): Promise<string> {
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("file", file);
  const response = await fetch("/api/natori/admin/project-thumbs", {
    method: "POST",
    headers: { ...CSRF_HEADERS },
    body: form,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to upload thumbnail (${response.status})`);
  }
  const payload = (await response.json()) as { url: string };
  return payload.url;
}

/**
 * Archives a project without deleting its tasks, images, or history.
 */
export async function deleteNatoriProject(projectId: string): Promise<void> {
  const response = await fetch(
    `/api/natori/admin/projects?id=${encodeURIComponent(projectId)}`,
    { method: "DELETE", headers: { ...CSRF_HEADERS } }
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to delete Natori project (${response.status})`);
  }
}

export async function restoreNatoriProject(projectId: string): Promise<void> {
  await patchNatoriAdminProject({ kind: "restore", projectId });
}
