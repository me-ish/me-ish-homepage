import { NextResponse } from "next/server";
import { canAccessNatoriManagement } from "@/lib/natori/requireNatoriAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";

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

  return NextResponse.json({
    projects: (projects ?? []) as ProjectRow[],
    tasks: (tasks ?? []) as TaskRow[],
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
