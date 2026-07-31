import "server-only";
import { createTasksForType } from "@/features/natori/lib/projects";
import { canTransitionNatoriStatus } from "@/features/natori/lib/statusTransitions";
import { calculateDueDate } from "@/features/natori/lib/deliveryPlans";
import { isNatoriConcreteProjectType } from "@/features/natori/lib/projectReadModel";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";
import { signPortfolioReferenceImage } from "@/features/natori/server/portfolioSiteService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  NatoriConcreteProjectType,
  NatoriDeliveryPlan,
  NatoriProjectStatus,
  NatoriProjectTask,
} from "@/features/natori/types/projects";

export type NatoriAdminProjectRow = {
  id: string;
  user_id: string;
  title: string;
  client_name: string;
  client_email?: string | null;
  amount: number | null;
  type: string;
  status: string;
  delivery_plan: string;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  next_action: string;
  note: string | null;
  deleted_at: string | null;
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

export type NatoriAdminReferenceFile = {
  project_id: string;
  url: string;
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
    case "rough-submit":
      return (
        existingTaskDone(tasksByKey, [templateTask.id]) ||
        [
          "lineart",
          "coloring",
          "waiting",
          "delivery_prep",
          "delivered",
          "completed",
        ].includes(project.status)
      );
    case "lineart":
      return (
        existingTaskDone(tasksByKey, ["lineart", "line"]) ||
        [
          "coloring",
          "waiting",
          "delivery_prep",
          "delivered",
          "completed",
        ].includes(project.status)
      );
    case "color":
      return (
        existingTaskDone(tasksByKey, ["color", "coloring"]) ||
        ["waiting", "delivery_prep", "delivered", "completed"].includes(
          project.status
        )
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

/**
 * Keeps the legacy concrete-type display compatible without persisting any
 * normalization. Undecided/future types retain only their existing task rows.
 */
export function normalizeProjectTasksForRead(
  projects: NatoriAdminProjectRow[],
  tasks: NatoriAdminTaskRow[]
): NatoriAdminTaskRow[] {
  const tasksByProject = new Map<string, NatoriAdminTaskRow[]>();
  for (const task of tasks) {
    const list = tasksByProject.get(task.project_id) ?? [];
    list.push(task);
    tasksByProject.set(task.project_id, list);
  }

  return projects.flatMap((project) => {
    const existingTasks = tasksByProject.get(project.id) ?? [];
    if (!isNatoriConcreteProjectType(project.type)) {
      return existingTasks;
    }
    const tasksByKey = new Map(
      existingTasks.map((task) => [task.task_key, task])
    );
    return createTasksForType(project.type).map((templateTask, index) => {
      const existing = tasksByKey.get(templateTask.id);
      return {
        id: existing?.id ?? `read-template:${project.id}:${templateTask.id}`,
        project_id: project.id,
        task_key: templateTask.id,
        label: templateTask.label,
        stage: templateTask.stage,
        estimated_hours: templateTask.estimatedHours ?? null,
        done: shouldTemplateTaskBeDone(project, templateTask, tasksByKey),
        sort_order: index,
      };
    });
  });
}

export type ListNatoriAdminProjectsResult =
  | {
      kind: "ok";
      projects: NatoriAdminProjectRow[];
      archivedProjects: NatoriAdminProjectRow[];
      tasks: NatoriAdminTaskRow[];
      referenceFiles: NatoriAdminReferenceFile[];
    }
  | { kind: "fetch-projects-error" }
  | { kind: "fetch-tasks-error" };

export async function listNatoriAdminProjects(): Promise<ListNatoriAdminProjectsResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "fetch-projects-error" };
  const admin = supabaseAdmin();
  const [
    { data: projects, error: projectError },
    { data: archivedProjects, error: archivedProjectError },
  ] = await Promise.all([
    admin
      .from("natori_projects")
      .select("*")
      .eq("user_id", ownerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("natori_projects")
      .select("*")
      .eq("user_id", ownerId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  if (projectError || archivedProjectError) {
    console.error(
      "[natori-admin-projects] project fetch failed",
      projectError ?? archivedProjectError
    );
    return { kind: "fetch-projects-error" };
  }

  // Keep application-side guards as defense in depth in case a mock, proxy, or
  // future query change returns rows outside the requested deleted_at lane.
  const projectRows = ((projects ?? []) as NatoriAdminProjectRow[]).filter(
    (project) => !project.deleted_at
  );
  const archivedProjectRows = (
    (archivedProjects ?? []) as NatoriAdminProjectRow[]
  ).filter((project) => Boolean(project.deleted_at));
  const projectIds = projectRows.map((project) => project.id);
  if (projectIds.length === 0) {
    return {
      kind: "ok",
      projects: [],
      archivedProjects: archivedProjectRows,
      tasks: [],
      referenceFiles: [],
    };
  }

  const [{ data: tasks, error: taskError }, { data: references, error: referenceError }] =
    await Promise.all([
      admin
        .from("natori_project_tasks")
        .select("*")
        .in("project_id", projectIds)
        .order("sort_order", { ascending: true }),
      admin
        .from("natori_inquiry_reference_files")
        .select("project_id, storage_path")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true }),
    ]);

  if (taskError) {
    console.error("[natori-admin-projects] task fetch failed", taskError);
    return { kind: "fetch-tasks-error" };
  }

  const taskRows = (tasks ?? []) as NatoriAdminTaskRow[];
  const normalizedTasks = normalizeProjectTasksForRead(projectRows, taskRows);
  if (referenceError) {
    console.error("[natori-admin-projects] reference fetch failed", referenceError);
  }

  const referenceFiles: NatoriAdminReferenceFile[] = [];
  for (const row of (references ?? []) as Array<{ project_id: string; storage_path: string }>) {
    const url = await signPortfolioReferenceImage(row.storage_path, 60 * 60);
    if (url) referenceFiles.push({ project_id: row.project_id, url });
  }

  return {
    kind: "ok",
    projects: projectRows,
    archivedProjects: archivedProjectRows,
    tasks: normalizedTasks,
    referenceFiles,
  };
}

export type CreateNatoriAdminProjectInput = {
  userId: string;
  title: string;
  clientName: string;
  /** 依頼者メール（inquiry 起票時に保存。以後の送信画面はカラムを参照する） */
  clientEmail?: string;
  amount: number;
  type: NatoriConcreteProjectType;
  status?: string;
  deliveryPlan?: NatoriDeliveryPlan;
  startDateISO?: string;
  dueDateISO?: string;
  nextAction?: string;
  note?: string;
  priority?: string;
  referencePaths?: string[];
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
  const manualCompletedAt =
    status === "completed" ? `${dueDateISO}T12:00:00+09:00` : "";

  const tasks = createTasksForType(input.type);
  const taskInserts = tasks.map((task, index) => ({
    task_key: task.id,
    label: task.label,
    stage: task.stage,
    estimated_hours: task.estimatedHours ?? null,
    done: task.done,
    sort_order: index,
  }));
  const { data: projectId, error } = await supabaseAdmin().rpc(
    "natori_create_project_with_tasks",
    {
      p_user_id: input.userId,
      p_project: {
        title: input.title,
        client_name: input.clientName,
        client_email: input.clientEmail?.trim() || "",
        amount: input.amount,
        type: input.type,
        status,
        delivery_plan: deliveryPlan,
        priority: input.priority ?? "",
        start_date: startDateISO,
        due_date: dueDateISO,
        next_action: input.nextAction ?? "",
        note: input.note ?? "",
        payment_confirmed_at: manualCompletedAt,
        paid_at: manualCompletedAt,
        paid_amount: manualCompletedAt ? input.amount : "",
        completed_at: manualCompletedAt,
      },
      p_tasks: taskInserts,
      p_reference_paths: input.referencePaths ?? [],
    }
  );
  if (error || !projectId) {
    console.error("[natori-admin-projects] transactional project insert failed", error);
    return { kind: "db-error" };
  }

  return { kind: "ok", projectId: String(projectId) };
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
  done: boolean,
  status: string,
  nextAction: string
): Promise<NatoriProjectMutationResult> {
  if (!NATORI_PROJECT_STATUSES.has(status)) return { kind: "db-error" };
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const { data, error } = await supabaseAdmin().rpc("natori_update_task_and_status", {
    p_user_id: ownerId,
    p_project_id: projectId,
    p_task_key: taskKey,
    p_done: done,
    p_status: status,
    p_next_action: nextAction,
  });

  if (error) {
    console.error("[natori-admin-projects] task update failed", error);
    return { kind: "db-error" };
  }
  if (data !== true) return { kind: "not-found" };
  return { kind: "ok" };
}

export async function setNatoriProjectStatus(
  projectId: string,
  status: string,
  nextAction: string
): Promise<NatoriProjectTransitionResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const admin = supabaseAdmin();

  const { data: current, error: fetchErr } = await admin
    .from("natori_projects")
    .select("id, status")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchErr) {
    console.error("[natori-admin-projects] status fetch failed", fetchErr);
    return { kind: "db-error" };
  }
  if (!current) return { kind: "not-found" };

  const fromStatus = (current as { status: string }).status;
  const workStatuses = new Set([
    "rough", "lineart", "coloring", "waiting", "delivery_prep", "delivered", "completed",
  ]);
  if (workStatuses.has(status)) {
    const { data: paidProject, error: paidError } = await admin
      .from("natori_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", ownerId)
      .is("deleted_at", null)
      .not("payment_confirmed_at", "is", null)
      .maybeSingle();
    if (paidError) return { kind: "db-error" };
    if (!paidProject) return { kind: "invalid-transition", from: fromStatus, to: status };
  }
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
  const statusUpdate: Record<string, unknown> = { status, next_action: nextAction };
  if (status === "completed") statusUpdate.completed_at = new Date().toISOString();
  const { data, error } = await admin
    .from("natori_projects")
    .update(statusUpdate)
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
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
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
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
    .eq("user_id", ownerId)
    .is("deleted_at", null)
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
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const admin = supabaseAdmin();

  const { data: current, error: fetchErr } = await admin
    .from("natori_projects")
    .select("id, note, status")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
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
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .eq("status", fromStatus)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-projects] close failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

/** 案件を復元可能なアーカイブへ移動する。行とStorageオブジェクトは保持する。 */
export async function deleteNatoriAdminProject(
  projectId: string
): Promise<NatoriProjectMutationResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-projects] project archive failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };

  return { kind: "ok" };
}

/**
 * "入金確認してラフ開始" button: stamps payment_confirmed_at and advances
 * status to `rough`. 遷移表の payment-confirmed ルール（受注前 → rough のみ）を
 * 条件付き UPDATE で原子的に適用する。既に制作中・完了・見送りの案件は 0 行に
 * なり invalid-transition を返す（webhook との競合でも二重確定しない）。
 */
export async function restoreNatoriAdminProject(
  projectId: string
): Promise<NatoriProjectMutationResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const { data, error } = await supabaseAdmin()
    .from("natori_projects")
    .update({ deleted_at: null })
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-projects] project restore failed", error);
    return { kind: "db-error" };
  }
  if (!data) return { kind: "not-found" };
  return { kind: "ok" };
}

export async function confirmNatoriProjectPayment(
  projectId: string,
  nextAction: string
): Promise<NatoriProjectTransitionResult> {
  const ownerId = await resolveNatoriActingUserId();
  if (!ownerId) return { kind: "not-found" };
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("natori_confirm_manual_payment", {
    p_user_id: ownerId,
    p_project_id: projectId,
    p_next_action: nextAction,
  });

  if (error) {
    console.error("[natori-admin-projects] confirm-payment failed", error);
    return { kind: "db-error" };
  }
  if (data === true) return { kind: "ok" };

  // 0行: 案件が無いのか、受注前ではないのかを切り分ける
  const { data: current, error: fetchErr } = await admin
    .from("natori_projects")
    .select("id, status")
    .eq("id", projectId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
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
