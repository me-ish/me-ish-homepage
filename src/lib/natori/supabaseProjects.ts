import { createClient } from "@/lib/supabase/client";
import { mockNatoriProjects } from "@/lib/natori/mockProjects";
import type {
  NatoriDeliveryPlan,
  NatoriProject,
  NatoriProjectPriority,
  NatoriProjectStatus,
  NatoriProjectTask,
  NatoriProjectType,
  NatoriTaskStage,
} from "@/types/natori/projects";

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

const PROJECTS_TABLE = "natori_projects";
const TASKS_TABLE = "natori_project_tasks";

function rowToProject(row: ProjectRow, taskRows: TaskRow[]): NatoriProject {
  const tasks: NatoriProjectTask[] = taskRows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
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
    tasks,
  };
}

export async function fetchNatoriProjects(): Promise<NatoriProject[]> {
  const supabase = createClient();
  const [{ data: projects, error: pe }, { data: tasks, error: te }] = await Promise.all([
    supabase.from(PROJECTS_TABLE).select("*").order("due_date", { ascending: true }),
    supabase.from(TASKS_TABLE).select("*").order("sort_order", { ascending: true }),
  ]);
  if (pe) throw pe;
  if (te) throw te;

  const projectRows = (projects ?? []) as ProjectRow[];
  const taskRows = (tasks ?? []) as TaskRow[];
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
  const supabase = createClient();
  const { error } = await supabase
    .from(TASKS_TABLE)
    .update({ done })
    .eq("project_id", projectId)
    .eq("task_key", taskKey);
  if (error) throw error;
}

export async function updateNatoriProjectStatus(
  projectId: string,
  status: NatoriProjectStatus,
  nextAction: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from(PROJECTS_TABLE)
    .update({ status, next_action: nextAction })
    .eq("id", projectId);
  if (error) throw error;
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
