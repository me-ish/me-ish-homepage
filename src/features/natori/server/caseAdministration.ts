import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriManagementContext } from "./natoriOwner";
import {
  caseAdminRequest,
  caseAdminReceipt,
  caseAdminView,
} from "../lib/caseAdministration";
import { createTasksForType } from "../lib/projects";
import {
  buildAcceptanceNotificationPayload,
  dispatchAcceptanceNotification,
} from "./acceptanceNotifications";
import type { Json } from "@/types/supabase";
import { normalizeNatoriReferenceUrl } from "../lib/referenceLinks";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
function preview(
  job: Parameters<typeof buildAcceptanceNotificationPayload>[0],
) {
  const payload = buildAcceptanceNotificationPayload(job);
  return {
    payload,
    display: {
      to: payload.to,
      from: payload.from,
      ...(payload.reply_to ? { replyTo: payload.reply_to } : {}),
      ...(payload.bcc ? { bcc: payload.bcc } : {}),
      subject: payload.subject,
      body: payload.text,
      hash: createHash("sha256").update(canonical(payload)).digest("hex"),
    },
  };
}
export async function readCaseAdministration(projectId: string, notificationId?:string) {
  const { ownerId } = await resolveNatoriManagementContext();
  const { data, error } = await supabaseAdmin().rpc(
    notificationId?"natori_case_admin_notice_read_v1":"natori_case_admin_read_v1",
    { p_owner: ownerId, p_project: projectId, ...(notificationId?{p_notice:notificationId}:{}) },
    { get: true },
  );
  if (error) throw Error("case_admin_read_unavailable");
  if (!data) return null;
  const view = caseAdminView.parse(data);
  if (view.project.id !== projectId) throw Error("case_admin_scope_mismatch");
  if(notificationId&&(view.selectedNotice?.id!==notificationId||view.notices.length!==1||view.notices[0].id!==notificationId))throw Error("case_notice_scope_mismatch");
  const ids = view.notices.filter((n) => n.retry_candidate).map((n) => n.id);
  if (ids.length) {
    const jobs = await supabaseAdmin()
      .from("natori_notification_jobs")
      .select("id,purpose,snapshot,payload")
      .eq("project_id", projectId)
      .in("id", ids);
    if (jobs.error) throw Error("notice_preview_unavailable");
    for (const n of view.notices) {
      if (!n.retry_candidate) continue;
      const job = jobs.data?.find((j) => j.id === n.id);
      try {
        if (!job) throw Error("missing");
        n.preview = preview(job).display;
      } catch {
        n.retry_candidate = false;
      }
    }
  }
  return view;
}
export async function lookupCaseAdministration(operationId: string) {
  const { ownerId } = await resolveNatoriManagementContext();
  const { data, error } = await supabaseAdmin().rpc(
    "natori_case_admin_lookup_v1",
    { p_owner: ownerId, p_operation: operationId },
    { get: true },
  );
  if (error) throw Error("case_admin_lookup_unavailable");
  return data ? caseAdminReceipt.parse(data) : null;
}
export async function commandCaseAdministration(raw: unknown) {
  const input = caseAdminRequest.parse(raw),
    { ownerId, operator } = await resolveNatoriManagementContext();
  const action = input.action;
  let values: Json = action;
  if(action.command==="reference-link")values={...action,normalizedUrl:action.mode==="remove"?null:normalizeNatoriReferenceUrl(action.url)};
  if (action.command === "create") {
    const d = action.data;
    values = {
      mode: d.mode,
      project: {
        title: d.title,
        client_name: d.clientName,
        client_email: d.clientEmail,
        type: d.type,
        status: d.status,
        amount: d.amount,
        delivery_plan: d.deliveryPlan,
        start_date: d.startDate,
        due_date: d.dueDate,
        note: d.note,
        next_action: "相談内容を確認する",
      },
      tasks: createTasksForType(d.type).map((t, i) => ({
        task_key: t.id,
        label: t.label,
        stage: t.stage,
        estimated_hours: t.estimatedHours ?? null,
        done: t.done,
        sort_order: i,
      })),
    };
  }
  const replay = await supabaseAdmin().rpc("natori_case_admin_replay_v1", {
    p_owner: ownerId,
    p_operation: input.operationId,
    p_project: input.projectId,
    p_command: action.command,
    p_revision: input.revision,
    p_input: values,
  });
  if (replay.error) throw Error("case_admin_result_unconfirmed");
  if (replay.data) return replay.data;
  if (action.command === "retry-notice") {
    const job = await supabaseAdmin()
      .from("natori_notification_jobs")
      .select("id,purpose,snapshot,payload")
      .eq("id", action.notificationId)
      .eq("project_id", input.projectId!)
      .maybeSingle();
    if (job.error) throw Error("notice_preview_unavailable");
    if (!job.data) return { result: "not_found" };
    try {
      const current = preview(job.data);
      if (current.display.hash !== action.previewHash)
        return { result: "confirmation_stale" };
      values = {
        ...action,
        payload: job.data.payload ?? (current.payload as unknown as Json),
      };
    } catch {
      return { result: "confirmation_stale" };
    }
  }
  const { data, error } = await supabaseAdmin().rpc(
    action.command==="intake-memo"||action.command==="reference-link"?"natori_case_context_command_v1":"natori_case_admin_command_v1",
    {
      p_owner: ownerId,
      p_operation: input.operationId,
      p_project: input.projectId,
      p_command: action.command,
      p_revision: input.revision,
      p_input: values,
      p_operator: operator as Json,
    },
  );
  if (error) throw Error("case_admin_result_unconfirmed");
  const result = data as {
    result?: string;
    notificationId?: string;
    replayed?: boolean;
  };
  // A replay only returns the saved receipt. It never redispatches an external request.
  if (result.result === "queued" && !result.replayed && result.notificationId)
    await dispatchAcceptanceNotification(result.notificationId, true);
  return data;
}
