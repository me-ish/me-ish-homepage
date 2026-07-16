import "server-only";
import { createTasksForType } from "@/features/natori/lib/projects";
import { canTransitionNatoriStatus } from "@/features/natori/lib/statusTransitions";
import { calculateDueDate } from "@/features/natori/lib/deliveryPlans";
import { deleteNatoriProjectThumb } from "@/features/natori/server/projectThumbsService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  NatoriDeliveryPlan,
  NatoriProjectStatus,
  NatoriProjectTask,
  NatoriProjectType,
} from "@/features/natori/types/projects";

export type NatoriAdminProjectRow = {
  id: string;
  user_id: string;
  title: string;
  client_name: string;
  client_email?: string | null;
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
  // 見送り: 条件がまとまらなかった相談の終端（実績・ボード対象外）
  "closed",
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
    const { error } = await admin
      .from("natori_project_tasks")
      .upsert(upserts, { onConflict: "project_id,task_key" });
    if (error) {
      console.error("[natori-admin-projects] task normalization upsert failed", error);
      throw error;
    }
  }

  if (deleteIds.length > 0) {
    const { error } = await admin
      .from("natori_project_tasks")
      .delete()
      .in("id", deleteIds);
    if (error) {
      console.error("[natori-admin-projects] task normalization delete failed", error);
      throw error;
    }
  }

  const { data, error } = await admin
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
      admin.from("natori_projects").select("*").order("due_date", { ascending: true }),
      admin.from("natori_project_tasks").select("*").order("sort_order", { ascending: true }),
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
  /** 依頼者メール（inquiry 起票時に保存。以後の送信画面はカラムを参照する） */
  clientEmail?: string;
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
  const { data: insertedProject, error: projectErr } = await admin
    .from("natori_projects")
    .insert({
      user_id: input.userId,
      title: input.title,
      client_name: input.clientName,
      client_email: input.clientEmail?.trim() || null,
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
    const { error: taskErr } = await admin
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

/** ステータス遷移を伴う操作の結果（許可遷移表に無い遷移は invalid-transition） */
export type NatoriProjectTransitionResult =
  | NatoriProjectMutationResult
  | { kind: "invalid-transition"; from: string; to: string };

export type PatchNatoriProjectDetailsResult =
  | NatoriProjectMutationResult
  | { kind: "no-editable-fields" };

export async function setNatoriProjectTaskDone(
  projectId: string,
  taskKey: string,
  done: boolean
): Promise<NatoriProjectMutationResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
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
): Promise<NatoriProjectTransitionResult> {
  const admin = supabaseAdmin();

  const { data: current, error: fetchErr } = await admin
    .from("natori_projects")
    .select("id, status")
    .eq("id", projectId)
    .maybeSingle();
  if (fetchErr) {
    console.error("[natori-admin-projects] status fetch failed", fetchErr);
    return { kind: "db-error" };
  }
  if (!current) return { kind: "not-found" };

  const fromStatus = (current as { status: string }).status;
  if (
    !canTransitionNatoriStatus(
      fromStatus as NatoriProjectStatus,
      status as NatoriProjectStatus
    )
  ) {
    return { kind: "invalid-transition", from: fromStatus, to: status };
  }

  // 読み取り時のステータスを条件に含め、並行更新とレースしたら書かない
  // （0行なら状態が変わっているので invalid-transition として弾く）
  const { data, error } = await admin
    .from("natori_projects")
    .update({ status, next_action: nextAction })
    .eq("id", projectId)
    .eq("status", fromStatus)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[natori-admin-projects] project status update failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "invalid-transition", from: fromStatus, to: status };
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
  const { data, error } = await admin
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
 * 相談を「見送り（closed）」にする。理由が渡されたら日付付きでメモ末尾に
 * 追記し、履歴として残す。削除と違い元に戻せる（status を戻すだけ）。
 * 受注前の案件のみ対象（入金済みの制作中案件は遷移表で弾かれる）。
 */
export async function closeNatoriProject(
  projectId: string,
  reason: string
): Promise<NatoriProjectTransitionResult> {
  const admin = supabaseAdmin();

  const { data: current, error: fetchErr } = await admin
    .from("natori_projects")
    .select("id, note, status")
    .eq("id", projectId)
    .maybeSingle();
  if (fetchErr) {
    console.error("[natori-admin-projects] close fetch failed", fetchErr);
    return { kind: "db-error" };
  }
  if (!current) return { kind: "not-found" };

  const fromStatus = (current as { status: string }).status;
  if (!canTransitionNatoriStatus(fromStatus as NatoriProjectStatus, "closed")) {
    return { kind: "invalid-transition", from: fromStatus, to: "closed" };
  }

  const update: Record<string, unknown> = {
    status: "closed",
    next_action: "",
  };
  const trimmedReason = reason.trim();
  if (trimmedReason) {
    const today = new Date().toISOString().slice(0, 10);
    const existingNote = (current as { note: string | null }).note ?? "";
    const entry = `【見送り ${today}】${trimmedReason}`;
    update.note = existingNote ? `${existingNote}\n\n${entry}` : entry;
  }

  const { data, error } = await admin
    .from("natori_projects")
    .update(update)
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-projects] close failed", error);
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

  const { error: taskErr } = await admin
    .from("natori_project_tasks")
    .delete()
    .eq("project_id", projectId);
  if (taskErr) {
    console.error("[natori-admin-projects] task delete failed", taskErr);
    return { kind: "db-error" };
  }

  const { data, error } = await admin
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

  // サムネイル画像もベストエフォートで片付ける（失敗しても削除自体は成功扱い）
  await deleteNatoriProjectThumb(projectId);
  return { kind: "ok" };
}

/** 入金確認（payment-confirmed 遷移）で rough に進める元ステータス（生値） */
const PAYMENT_CONFIRMABLE_STATUSES = [
  "inquiry",
  "estimating",
  "consulting",
  "quoted",
  "awaiting_payment",
] as const;

/**
 * "入金確認してラフ開始" button: stamps payment_confirmed_at and advances
 * status to `rough`. 遷移表の payment-confirmed ルール（受注前 → rough のみ）を
 * 条件付き UPDATE で原子的に適用する。既に制作中・完了・見送りの案件は 0 行に
 * なり invalid-transition を返す（webhook との競合でも二重確定しない）。
 */
export async function confirmNatoriProjectPayment(
  projectId: string,
  nextAction: string
): Promise<NatoriProjectTransitionResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("natori_projects")
    .update({
      status: "rough",
      next_action: nextAction,
      payment_confirmed_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .in("status", [...PAYMENT_CONFIRMABLE_STATUSES])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[natori-admin-projects] confirm-payment failed", error);
    return { kind: "db-error" };
  }
  if (data) return { kind: "ok" };

  // 0行: 案件が無いのか、受注前ではないのかを切り分ける
  const { data: current, error: fetchErr } = await admin
    .from("natori_projects")
    .select("id, status")
    .eq("id", projectId)
    .maybeSingle();
  if (fetchErr) {
    console.error("[natori-admin-projects] confirm-payment refetch failed", fetchErr);
    return { kind: "db-error" };
  }
  if (!current) return { kind: "not-found" };
  return {
    kind: "invalid-transition",
    from: (current as { status: string }).status,
    to: "rough",
  };
}
