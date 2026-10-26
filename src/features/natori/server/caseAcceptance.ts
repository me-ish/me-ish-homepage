import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertServerAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import {acceptanceEventRequestAllowed} from "./caseAcceptanceEvents";
import type { Json } from "@/types/supabase";
import { caseNoMailBudgetSchema } from "../lib/caseNoMailBudget";
import { caseNoMailAcceptanceEnabled } from "./caseNoMailAcceptance";

export async function acceptanceRpc(
  name: string,
  args: Record<string, Json | undefined>,
): Promise<unknown> {
  const call = supabaseAdmin().rpc.bind(supabaseAdmin()) as unknown as (
    name: string,
    args: Record<string, Json | undefined>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const result = await call(name, args);
  if (result.error) throw Error("acceptance_record_unconfirmed");
  return result.data;
}
const contextSchema = z.object({
  scope: z.string().min(1),
  account: z.string().regex(/^acct_[A-Za-z0-9]+$/),
  origin: z.string(),
  ref: z.string(),
  active: z.boolean(),
  paymentUrl: z.string().nullable().optional(),
});
export async function acceptanceContext(
  owner: string,
  project: string,
  mutation = false,
) {
  const target = assertServerAcceptanceTarget(!mutation);
  if (!target) return null;
  const c = contextSchema.parse(
    await acceptanceRpc("natori_case_acceptance_context_v1", {
      p_run: target.run,
      p_owner: owner,
      p_project: project,
      p_mutation: mutation,
    }),
  );
  if (
    c.origin !== target.origin ||
    c.ref !== target.ref ||
    c.scope !== process.env.NATORI_CASE_ACCEPTANCE_MAIL_SCOPE ||
    c.account !== process.env.NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT ||
    (mutation && !c.active)
  )
    throw Error("acceptance_scope_invalid");
  if (caseNoMailAcceptanceEnabled(!mutation)) {
    const { data, error } = await supabaseAdmin().from("natori_case_acceptance_runs")
      .select("id,owner_id,project_ref,origin,provider_scope,stripe_account,starts_at,ends_at,enabled,allowed_to,human_to,mail_limit,human_limit,used,human_used")
      .eq("id", target.run).eq("owner_id", owner).maybeSingle();
    const parsed = caseNoMailBudgetSchema.extend({
      id: z.uuid(), owner_id: z.uuid(), project_ref: z.string(), origin: z.string(),
      provider_scope: z.string(), stripe_account: z.string(), starts_at: z.string(),
      ends_at: z.string(), enabled: z.boolean(),
    }).safeParse(data);
    if (error || !parsed.success) throw Error("acceptance_no_mail_run_invalid");
    const run = parsed.data;
    if (run.id !== target.run || run.owner_id !== owner || run.project_ref !== target.ref
      || run.origin !== target.origin || run.provider_scope !== c.scope || run.stripe_account !== c.account
      || Date.parse(run.starts_at) !== Date.parse(target.startsAt)
      || Date.parse(run.ends_at) !== Date.parse(target.endsAt) || (mutation && !run.enabled)) {
      throw Error("acceptance_no_mail_run_invalid");
    }
  }
  return { ...c, target };
}
export function acceptanceStripeKey(observe = false): string {
  const target = assertServerAcceptanceTarget(observe);
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (
    target &&
    (process.env.NATORI_STRIPE_MODE !== "test" ||
      !/^(sk|rk)_test_[A-Za-z0-9_]+$/.test(key) ||
      !/^acct_[A-Za-z0-9]+$/.test(
        process.env.NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT ?? "",
      ))
  )
    throw Error("acceptance_stripe_invalid");
  return key;
}

/** Acceptance is an explicit fixture allowlist, separate from ordinary owner authorization. */
export async function acceptanceProjectAllowed(
  project: string,
  mutation = false,
): Promise<boolean> {
  if (!assertServerAcceptanceTarget(true)) return true;
  const { resolveTrustedNatoriOwnerId } = await import("./trustedNatoriOwner");
  const owner = resolveTrustedNatoriOwnerId();
  if (owner.kind !== "ok") return false;
  try {
    return Boolean(await acceptanceContext(owner.ownerId, project, mutation));
  } catch {
    return false;
  }
}
export async function acceptanceManagementRequestAllowed(
  operation: string,
  args: unknown[],
  mutation: boolean,
): Promise<boolean> {
  if (!assertServerAcceptanceTarget(true)) return true;
  if (operation === "case-workspace.GET") return true; // Collection is filtered before adaptation.
  if (operation === "case-system.GET") return !mutation;
  if (operation === "case-system.POST") return mutation; // Owner-bound control metadata only.
  const request = args.find((v): v is Request => v instanceof Request);
  if (!request) return false;
  const params = new URL(request.url).searchParams;
  if(operation.startsWith("events.")||(operation==="case-entry-index.GET"&&params.get("kind")==="events"))return acceptanceEventRequestAllowed(operation,request,mutation);
  // Notice collection remains filtered by the registered project set.
  if(operation==="case-entry-index.GET")return !mutation&&params.getAll("kind").length===1&&params.get("kind")==="notices";
  const body: unknown = mutation
    ? await request
        .clone()
        .json()
        .catch(() => null)
    : null;
  const input =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  if (mutation && ["fileId", "id", "quoteId"].some((key) => params.has(key)))
    return false; // Writers consume these identifiers from their body only.
  const nested =
    operation === "case-work.POST" &&
    input.command === "delivery" &&
    input.request &&
    typeof input.request === "object"
      ? (input.request as Record<string, unknown>)
      : null;
  const nestedProject =
    nested && typeof nested.projectId === "string" ? nested.projectId : null;
  const topProject =
    typeof input.projectId === "string" ? input.projectId : null;
  if (nestedProject && topProject && nestedProject !== topProject) return false;
  const queryProject = params.get("projectId"),
    bodyProject = nestedProject ?? topProject;
  const active =
    mutation &&
    !(
      operation === "case-reconciliation.POST" &&
      ["inspect", "apply-evidence"].includes(String(input.action))
    );
  if (
    params.getAll("projectId").length > 1 ||
    (queryProject && bodyProject && queryProject !== bodyProject)
  )
    return false;
  let project = queryProject ?? bodyProject;
  const file =
    params.get("fileId") ??
    (typeof input.fileId === "string" ? input.fileId : null);
  const notification = operation.startsWith("notifications.")
    ? (params.get("id") ?? (typeof input.id === "string" ? input.id : null))
    : null;
  const quote = typeof input.quoteId === "string" ? input.quoteId : null;
  const references: [
    "natori_delivery_files" | "natori_notification_jobs" | "natori_quotes",
    string | null,
  ][] = [
    ["natori_delivery_files", file],
    ["natori_notification_jobs", notification],
    ["natori_quotes", quote],
  ];
  for (const [table, id] of references) {
    if (!id) continue;
    const row = await supabaseAdmin()
      .from(table)
      .select("project_id")
      .eq("id", id)
      .maybeSingle();
    if (row.error) return false;
    if (!row.data) {
      // The upload reserve endpoint accepts a new client-chosen UUID. The DB
      // reserve still checks its uniqueness and the scoped parent project.
      if (
        operation === "delivery-files.POST" &&
        table === "natori_delivery_files" &&
        project
      )
        continue;
      return false;
    }
    if (project && row.data.project_id !== project) return false;
    project = row.data.project_id;
  }
  return Boolean(project) && acceptanceProjectAllowed(project!, active);
}
