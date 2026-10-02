import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import Stripe from "stripe";
import { NextRequest } from "next/server";

const check = (value: unknown, code: string): void => { if (!value) throw new Error(code); };
const phase6aFailureCodes = new Set(["ANON_DENIED","ASSERTION_FAILED","AUTH_FIXTURE","BOTH_APPLIED","CLIENT_PROJECTION_IGNORED","CLOSE_CONFLICT","CLOSE_FACTS","DESTINATION_REJECTED","DISTINCT_COMMITTED_REVISIONS","HIDDEN_DOES_NOT_PIN","HIDDEN_HISTORY_RETAINED","HOLD_NOT_ACQUIRED","HOLD_QUERY","HOLD_TRANSACTION","LATEST_AGGREGATE","LATEST_LOCKED_TASKS","LATEST_RPC_NEXT_ACTION","LATEST_STORED_NEXT_ACTION","LATEST_STORED_PROJECTION","LEGACY_APPLIED","LIFECYCLE_REVISION","NO_AUTO_RECEIPT","NO_TASK_ON_CLOSED","ONE_PAYMENT_LEDGER","OWNER_FENCE","PAYMENT_FACTS_RETAINED","PAYMENT_QUOTE","PAYMENT_TASK_RACE","PHASE_6A_FAILED","PROJECT_FIXTURE","QUOTE_ACCEPTANCE_FACTS_RETAINED","QUOTE_FIXTURE","READ_PROJECT","RECEIPT_FACTS","RECEIPT_RACE","SAME_TASK_LAST_COMMIT","SAME_TASK_NEXT_ACTION_MATCHES_COMMIT","SNAPSHOT_AFTER_COMMIT","SNAPSHOT_BEFORE_COMMIT","SNAPSHOT_HOLD","SNAPSHOT_OWNER","SNAPSHOT_RPC","STAGE_FINAL_FACTS","STAGE_RACE_FINISHED","STATUS_MATCHES_COMMIT","TASK_DOES_NOT_ENQUEUE_NOTIFICATION","TASK_FIXTURE","TASK_NOTICE_COUNT_BEFORE","TASK_NOT_LOST","TASK_RECALC_PRESERVES_FACTS","TASK_RPC","TERMINAL_CONFLICT","TERMINAL_FIXTURE","TERMINAL_TASK_UNCHANGED"]);
function safePhase6aFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return phase6aFailureCodes.has(message) ? message : "ASSERTION_FAILED";
}
const results: { name: string; status: string; code?: string }[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ name, status: "passed" }); console.log(`PASS phase6a/${name}`); }
  catch (error) {
    const code = safePhase6aFailureCode(error);
    results.push({ name, status: "failed", code }); console.log(`FAIL phase6a/${name} ${code}`);
  }
}
type Projection = { id: string; status: string; nextAction: string; mutationRevision: number;
  tasks: { id: string; done: boolean; stage: string }[]; completedAt: string | null;
  deliveryAcceptedAt: string | null; deliveredMailAt: string | null; paymentConfirmedAt: string | null };
type Outcome = { result: string; project: Projection };
async function main() {
  const { origin } = JSON.parse(readFileSync("/runtime/network.json", "utf8"));
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), "DESTINATION_REJECTED");
  const keys = JSON.parse(readFileSync("/runtime/credentials.json", "utf8"));
  const direct = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== origin) throw new Error("DESTINATION_REJECTED");
    return direct(input, init);
  };
  try {
    const db = createClient(origin, keys.service, { auth: { persistSession: false } });
    const peer = createClient(origin, keys.service, { auth: { persistSession: false } });
    const anonymous = createClient(origin, keys.anon, { auth: { persistSession: false } });
    const auth = await db.auth.admin.createUser({ email: "owner@phase6a.invalid", password: randomBytes(32).toString("hex"), email_confirm: true });
    check(!auth.error && auth.data.user, "AUTH_FIXTURE"); const owner = auth.data.user!.id;
    const stamp = new Date().toISOString(), secret = "whsec_" + randomBytes(32).toString("hex");
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon,
      SUPABASE_SERVICE_ROLE_KEY: keys.service, STRIPE_SECRET_KEY: "sk_test_" + randomBytes(32).toString("hex"),
      STRIPE_WEBHOOK_SECRET: secret, NATORI_OWNER_USER_ID: owner, NATORI_PAYMENT_INTEGRITY_ENABLED: "1",
      NATORI_PAYMENT_LINK_INTEGRITY_ENABLED: "1", NATORI_STRIPE_MODE: "test", NATORI_ACCEPTANCE_OUTBOX_ENABLED: "1",
      NATORI_NOTIFICATION_SENDING_ENABLED: "0", RESEND_API_KEY: "", ADMIN_API_TOKEN: "" });
    const webhook = await import("../../src/app/api/webhook/stripe/route");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    async function setup(options: { status?: string; paid?: boolean; hidden?: boolean; final?: boolean; delivered?: boolean } = {}) {
      const status = options.status ?? "rough", paid = options.paid ?? true;
      const project = await db.from("natori_projects").insert({ user_id: owner, title: "Task fixture", client_name: "Synthetic",
        client_email: "client@phase6a.invalid", type: "illustration", status, amount: 12000, next_action: "one",
        payment_confirmed_at: paid ? stamp : null, paid_at: paid ? stamp : null, paid_amount: paid ? 12000 : null,
        delivered_mail_at: options.delivered ? stamp : null,
        delivery_token_hash: options.delivered ? createHash("sha256").update(randomUUID()).digest("hex") : null,
        delivery_token_expires_at: options.delivered ? new Date(Date.now() + 86400000).toISOString() : null }).select("*").single();
      check(!project.error && project.data, "PROJECT_FIXTURE"); const p = project.data!;
      const tasks = [{ project_id: p.id, task_key: "one", label: "one", stage: "rough", done: false, sort_order: 1 },
        { project_id: p.id, task_key: "two", label: "two", stage: options.final ? "delivery" : "lineart", done: options.final ?? false, sort_order: 2 }];
      if (options.hidden) tasks.unshift({ project_id: p.id, task_key: "hidden", label: "hidden", stage: "material", done: false, sort_order: 0 });
      check(!(await db.from("natori_project_tasks").insert(tasks)).error, "TASK_FIXTURE"); return p;
    }
    async function mutate(project: string, key: string, done: boolean, client = db): Promise<Outcome> {
      const response = await client.rpc("natori_update_task_v1", { p_owner: owner, p_project: project, p_task_key: key, p_done: done });
      check(!response.error && response.data, "TASK_RPC"); return response.data as Outcome;
    }
    async function row(id: string) { const r = await db.from("natori_projects").select("*").eq("id", id).single(); check(!r.error && r.data, "READ_PROJECT"); return r.data!; }
    async function snapshot(id: string, client = db) {
      const r = await client.rpc("natori_project_task_snapshot_v1", { p_owner: owner, p_project_ids: [id] });
      check(!r.error && r.data, "SNAPSHOT_RPC"); return r.data as { projects: { id: string; status: string; mutation_revision: number }[]; tasks: { task_key: string; done: boolean }[] };
    }
    async function waitHeld(id: string) {
      const until = Date.now() + 2000;
      while (Date.now() < until) {
        const r = await peer.rpc("phase6a_project_is_held_v1", { p_project: id }); check(!r.error, "HOLD_QUERY");
        if (r.data === true) return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error("HOLD_NOT_ACQUIRED");
    }
    const taskDone = (p: Projection, key: string) => p.tasks.find(t => t.id === key)?.done;
    await test("two-clients-different-tasks-have-fresh-aggregate-and-increasing-revision", async () => {
      const p = await setup(); const responses = await Promise.all([mutate(p.id, "one", true), mutate(p.id, "two", true, peer)]);
      check(responses.every(r => r.result === "applied"), "BOTH_APPLIED");
      check(new Set(responses.map(r => r.project.mutationRevision)).size === 2
        && responses.every(r => r.project.mutationRevision > p.mutation_revision), "DISTINCT_COMMITTED_REVISIONS");
      const latest = responses.sort((a, b) => b.project.mutationRevision - a.project.mutationRevision)[0].project;
      check(latest.tasks.every(t => t.done) && latest.status === "delivery_prep", "LATEST_AGGREGATE");
      const stored = await row(p.id); check(stored.mutation_revision === latest.mutationRevision && stored.completed_at === null && stored.delivery_accepted_at === null, "NO_AUTO_RECEIPT");
      check(stored.status === latest.status && stored.next_action === latest.nextAction, "LATEST_STORED_PROJECTION");
    });
    await test("two-clients-same-task-final-value-matches-highest-committed-revision", async () => {
      const p = await setup(); await mutate(p.id, "one", true);
      const responses = await Promise.all([mutate(p.id, "one", false), mutate(p.id, "one", true, peer)]);
      const latest = responses.sort((a, b) => b.project.mutationRevision - a.project.mutationRevision)[0].project;
      const tasks = await db.from("natori_project_tasks").select("done").eq("project_id", p.id).eq("task_key", "one").single();
      check(!tasks.error && tasks.data?.done === taskDone(latest, "one"), "SAME_TASK_LAST_COMMIT");
      check((await row(p.id)).status === latest.status, "STATUS_MATCHES_COMMIT");
      check((await row(p.id)).next_action === latest.nextAction, "SAME_TASK_NEXT_ACTION_MATCHES_COMMIT");
    });
    await test("blocked-second-task-recalculates-after-project-first-lock-is-released", async () => {
      const p = await setup();
      const holding = Promise.resolve(db.rpc("phase6a_update_and_hold_v1", { p_owner: owner, p_project: p.id, p_task_key: "one", p_done: true, p_seconds: 1.5 }));
      await waitHeld(p.id); const second = mutate(p.id, "two", true, peer);
      check(!(await holding).error, "HOLD_TRANSACTION"); const result = await second;
      check(result.project.tasks.every(t => t.done) && result.project.status === "delivery_prep", "LATEST_LOCKED_TASKS");
    });
    await test("legacy-wrapper-ignores-forged-status-next-action-and-keeps-final-preparation", async () => {
      const p = await setup({ final: true });
      const old = await peer.rpc("natori_update_task_and_status", { p_user_id: owner, p_project_id: p.id, p_task_key: "one", p_done: true, p_status: "completed", p_next_action: "forged stale whole project" });
      check(!old.error && old.data === true, "LEGACY_APPLIED"); const stored = await row(p.id);
      check(stored.status === "delivery_prep" && stored.next_action !== "forged stale whole project" && !stored.completed_at && !stored.delivery_accepted_at, "CLIENT_PROJECTION_IGNORED");
    });
    await test("legacy-hidden-unchecked-material-does-not-pin-visible-finished-production", async () => {
      const p = await setup({ hidden: true, final: true }); const result = await mutate(p.id, "one", true);
      check(result.project.status === "delivery_prep" && taskDone(result.project, "hidden") === false, "HIDDEN_HISTORY_RETAINED");
      check(result.project.nextAction !== "hidden", "HIDDEN_DOES_NOT_PIN");
    });
    await test("last-task-and-conditional-stage-writer-never-auto-complete-or-drop-task", async () => {
      const p = await setup({ final: true }); const [task, stage] = await Promise.all([mutate(p.id, "one", true),
        peer.from("natori_projects").update({ status: "lineart", next_action: "manual stage" }).eq("id", p.id).eq("user_id", owner).eq("status", "rough").select("id")]);
      check(task.result === "applied" && !stage.error, "STAGE_RACE_FINISHED"); const stored = await row(p.id);
      check(stored.status === "delivery_prep" && !stored.completed_at && !stored.delivery_accepted_at, "STAGE_FINAL_FACTS");
      check(task.project.tasks.every(t => t.done), "TASK_NOT_LOST");
    });
    await test("task-and-signed-payment-webhook-retain-money-and-never-reopen-terminal", async () => {
      const p = await setup({ status: "awaiting_payment", paid: false });
      const quote = await db.from("natori_quotes").insert({ project_id: p.id, user_id: owner, version: 1, title: "Task fixture", client_name: "Synthetic", to_email: "client@phase6a.invalid",
        amount: 12000, subject: "Synthetic", body_snapshot: "Synthetic", token_hash: createHash("sha256").update(randomUUID()).digest("hex"), expires_at: new Date(Date.now() + 86400000).toISOString(), accepted_at: stamp }).select("id").single();
      check(!quote.error && quote.data, "QUOTE_FIXTURE");
      check(!(await db.from("natori_projects").update({ payment_quote_id: quote.data!.id, active_quote_id: quote.data!.id, quote_accepted_at: stamp, quote_accepted_amount: 12000, quoted_amount: 12000 }).eq("id", p.id)).error, "PAYMENT_QUOTE");
      const event = { id: "evt_" + randomUUID().replaceAll("-", ""), object: "event", type: "checkout.session.completed", livemode: false,
        created: Math.floor(Date.now() / 1000), data: { object: { id: "cs_test_" + randomUUID().replaceAll("-", ""), object: "checkout.session", payment_status: "paid", status: "complete",
          amount_total: 12000, currency: "jpy", payment_intent: "pi_test_" + randomUUID().replaceAll("-", ""), metadata: { kind: "natori_commission", projectId: p.id, quoteId: quote.data!.id } } } };
      const payload = JSON.stringify(event), signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
      const [task, payment] = await Promise.all([mutate(p.id, "one", true, peer), webhook.POST(new NextRequest("http://localhost/api/webhook/stripe", { method: "POST", body: payload, headers: { "stripe-signature": signature } }))]);
      check(payment.status === 200 && ["applied", "conflict"].includes(task.result), "PAYMENT_TASK_RACE");
      const stored = await row(p.id); check(stored.payment_confirmed_at && stored.paid_amount === 12000 && !stored.completed_at, "PAYMENT_FACTS_RETAINED");
      check(stored.quote_accepted_at !== null && Date.parse(stored.quote_accepted_at) === Date.parse(stamp) && stored.quote_accepted_amount === 12000
        && stored.active_quote_id === quote.data!.id && stored.payment_quote_id === quote.data!.id, "QUOTE_ACCEPTANCE_FACTS_RETAINED");
      check((await db.from("natori_payment_transactions").select("id").eq("project_id", p.id)).data?.length === 1, "ONE_PAYMENT_LEDGER");
    });
    await test("close-and-unpaid-task-race-cannot-reopen-or-change-checkbox", async () => {
      const p = await setup({ status: "awaiting_payment", paid: false });
      const [task, close] = await Promise.all([mutate(p.id, "one", true), peer.rpc("natori_payment_links_v1", { p_owner_id: owner, p_project_id: p.id, p_command: "close", p_input: {} })]);
      check(task.result === "conflict" && !close.error && close.data.result === "completed", "CLOSE_CONFLICT");
      const stored = await row(p.id); check(stored.status === "closed" && !stored.completed_at && !stored.payment_confirmed_at, "CLOSE_FACTS");
      check(!(await snapshot(p.id)).tasks.some(t => t.done), "NO_TASK_ON_CLOSED");
    });
    await test("receipt-and-task-race-keeps-accepted-completion-and-revision", async () => {
      const p = await setup({ status: "delivered", delivered: true });
      const [task, receipt] = await Promise.all([mutate(p.id, "one", true), peer.rpc("natori_accept_delivery_v1", { p_token_hash: p.delivery_token_hash })]);
      check(task.result === "conflict" && !receipt.error && ["accepted", "already-accepted"].includes(receipt.data?.[0]?.result), "RECEIPT_RACE");
      const stored = await row(p.id); check(stored.status === "completed" && stored.completed_at && stored.delivery_accepted_at && stored.delivered_mail_at === p.delivered_mail_at, "RECEIPT_FACTS");
      check(stored.mutation_revision > p.mutation_revision, "LIFECYCLE_REVISION");
    });
    await test("single-statement-snapshot-is-coherent-before-and-after-uncommitted-task", async () => {
      const p = await setup(); const before = await snapshot(p.id);
      const quietBefore = await db.from("natori_notification_jobs").select("id", { count: "exact", head: true }).eq("project_id", p.id);
      check(!quietBefore.error && quietBefore.count !== null, "TASK_NOTICE_COUNT_BEFORE");
      const holding = Promise.resolve(db.rpc("phase6a_update_and_hold_v1", { p_owner: owner, p_project: p.id, p_task_key: "one", p_done: true, p_seconds: 1.5 }));
      await waitHeld(p.id); const during = await snapshot(p.id, peer);
      check(during.projects[0].mutation_revision === before.projects[0].mutation_revision && during.tasks.every(t => !t.done), "SNAPSHOT_BEFORE_COMMIT");
      check(!(await holding).error, "SNAPSHOT_HOLD"); const after = await snapshot(p.id, peer);
      // Actual RPC and persisted projection must both reflect the latest pending task.
      const committedTask = await holding;
      check((committedTask.data as Outcome).project.nextAction === "two", "LATEST_RPC_NEXT_ACTION");
      const stored = await row(p.id);
      check(stored.next_action === "two" && stored.status === "lineart", "LATEST_STORED_NEXT_ACTION");
      check(stored.payment_confirmed_at === p.payment_confirmed_at && stored.paid_at === p.paid_at
        && stored.paid_amount === p.paid_amount && stored.completed_at === p.completed_at
        && stored.delivered_mail_at === p.delivered_mail_at && stored.delivery_accepted_at === p.delivery_accepted_at,
      "TASK_RECALC_PRESERVES_FACTS");
      check(after.projects[0].mutation_revision > before.projects[0].mutation_revision && after.tasks.find(t => t.task_key === "one")?.done === true && after.projects[0].status === "lineart", "SNAPSHOT_AFTER_COMMIT");
      const quietAfter = await db.from("natori_notification_jobs").select("id", { count: "exact", head: true }).eq("project_id", p.id);
      check(!quietAfter.error && quietAfter.count === quietBefore.count, "TASK_DOES_NOT_ENQUEUE_NOTIFICATION");
    });
    await test("terminal-paid-archived-and-undecided-facts-reject-task-mutations", async () => {
      for (const extra of [{ status: "completed", completed_at: stamp }, { status: "closed" }, { status: "delivered", delivered_mail_at: stamp }, { deleted_at: stamp }, { type: "undecided" }]) {
        // Existing Phase 2C guards require a terminal history before closing/archiving.
        const bornClosed = extra.status === "closed" || "deleted_at" in extra;
        const p = await setup({ status: bornClosed ? "closed" : "rough" }); check(!(await db.from("natori_projects").update(extra).eq("id", p.id)).error, "TERMINAL_FIXTURE");
        check((await mutate(p.id, "one", true)).result === "conflict", "TERMINAL_CONFLICT");
        check(!(await snapshot(p.id)).tasks.some(t => t.done), "TERMINAL_TASK_UNCHANGED");
      }
    });
    await test("owner-and-anonymous-boundaries-no-cross-owner-or-direct-client-rpc", async () => {
      const p = await setup(), fakeOwner = randomUUID();
      const wrong = await db.rpc("natori_update_task_v1", { p_owner: fakeOwner, p_project: p.id, p_task_key: "one", p_done: true });
      check(!wrong.error && wrong.data.result === "not_found", "OWNER_FENCE");
      const denied = await anonymous.rpc("natori_update_task_v1", { p_owner: owner, p_project: p.id, p_task_key: "one", p_done: true }); check(denied.error, "ANON_DENIED");
      const hidden = await db.rpc("natori_project_task_snapshot_v1", { p_owner: fakeOwner, p_project_ids: [p.id] }); check(!hidden.error && hidden.data.projects.length === 0 && hidden.data.tasks.length === 0, "SNAPSHOT_OWNER");
    });
    writeFileSync("/results/phase6a-integration.json", JSON.stringify({ tests: results, passed: results.filter(r => r.status === "passed").length,
      failed: results.filter(r => r.status === "failed").length, skipped: 0, provider: "Synthetic signed event; no real Stripe/mail", database: "Dedicated Supabase Postgres; two clients" }, null, 2));
    check(results.length === 12 && results.every(r => r.status === "passed"), "PHASE_6A_FAILED");
  } finally { globalThis.fetch = direct; }
}
main().catch(() => { console.error("Phase 6A integration failed; raw logs withheld"); process.exitCode = 1; });
