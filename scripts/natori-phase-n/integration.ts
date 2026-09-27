import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { cookieScope } from "../natori-phase-0b/cookies";

const check: (ok: unknown, code: string) => asserts ok = (ok, code) => { if (!ok) throw new Error(code); };
const results: { name: string; status: string; code?: string }[] = [];
let stage = "configuration";
async function test(name: string, action: () => Promise<void>) {
  try { await action(); results.push({ name, status: "passed" }); console.log(`PASS phasen/${name}`); }
  catch (error) { const code = error instanceof Error && /^[A-Z_0-9]+$/.test(error.message) ? error.message : "UNEXPECTED_ERROR"; results.push({ name, status: "failed", code }); console.log(`FAIL phasen/${name} ${code}`); }
}
async function main() {
  const { origin } = JSON.parse(readFileSync("/runtime/network.json", "utf8")) as { origin: string };
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), "DESTINATION_REJECTED");
  const keys = JSON.parse(readFileSync("/runtime/credentials.json", "utf8")) as { anon: string; service: string };
  const captureOrigin = "http://127.0.0.1:3101";
  const apiKey = randomBytes(32).toString("hex");
  const accepted = new Map<string, { body: string; id: string }>();
  let providerCalls = 0, mode = "accept", dropFinish = false, loseAcceptance = false, rejectAcceptance = false;
  const capture = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += String(chunk);
    const key = String(request.headers["idempotency-key"] ?? "");
    try {
      const payload = JSON.parse(body);
      const addresses = [...payload.to, ...(payload.bcc ?? []), payload.reply_to];
      check(request.method === "POST" && request.url === "/emails" && request.headers.authorization === `Bearer ${apiKey}`, "CAPTURE_AUTH");
      check(payload.from === "Phase N <sender@phase-n.invalid>" && addresses.every((a: unknown) => typeof a === "string" && ["artist@phase-n.invalid", "client@phase-n.invalid", "bcc@phase-n.invalid"].includes(a)), "RECIPIENT_ALLOWLIST");
      check(key.startsWith("natori-notice/"), "IDEMPOTENCY_KEY");
      providerCalls++;
      const previous = accepted.get(key);
      if (previous) {
        response.writeHead(previous.body === body ? 200 : 409, { "content-type": "application/json" });
        response.end(JSON.stringify(previous.body === body ? { id: previous.id } : { name: "invalid_idempotent_request" }));
        return;
      }
      const nextMode = mode; mode = "accept";
      if (nextMode === "reject") { response.writeHead(422); response.end('{}'); return; }
      const id = randomUUID(); accepted.set(key, { body, id });
      if (nextMode === "drop") { response.destroy(); return; }
      response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ id }));
    } catch { response.writeHead(400); response.end('{}'); }
  });
  await new Promise<void>(resolve => capture.listen(3101, "127.0.0.1", resolve));
  const realFetch = globalThis.fetch;
  let networkCalls = 0;
  // Production transport stays unchanged; the sealed test runtime routes ONLY its
  // exact provider request to the local capture. Every other destination is denied.
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.href === "https://api.resend.com/emails") {
      networkCalls++; return realFetch(`${captureOrigin}/emails`, init);
    }
    check(url.origin === origin && !url.username && !url.password, "DESTINATION_REJECTED");
    const acceptance = /\/rpc\/natori_accept_(quote|delivery)_with_notifications_v1$/.test(url.pathname);
    if (acceptance && rejectAcceptance) { rejectAcceptance = false; return new Response('{}', { status: 503 }); }
    if (url.pathname.endsWith("/rpc/natori_notification_finish_v1") && dropFinish) { dropFinish = false; return new Response('{}', { status: 503 }); }
    networkCalls++;
    const response = await realFetch(input, init);
    if (acceptance && loseAcceptance) { loseAcceptance = false; check(response.ok, "COMMIT_BEFORE_LOST_RESPONSE"); return new Response('{}', { status: 503 }); }
    return response;
  };
  try {
    await test("reject-production-destination-before-network", async () => {
      const before = networkCalls;
      for (const url of ["https://production-example.supabase.co", "https://www.me-ish.art", "http://127.0.0.1:55431"]) {
        let denied = false; try { await fetch(url); } catch { denied = true; }
        check(denied, "PRODUCTION_NOT_BLOCKED");
      }
      check(networkCalls === before, "NETWORK_BEFORE_VALIDATION");
    });
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service,
      RESEND_API_KEY: apiKey, NATORI_ORDER_MAIL_FROM: "Phase N <sender@phase-n.invalid>", NATORI_PORTFOLIO_CONTACT_TO: "artist@phase-n.invalid", NATORI_MAIL_BCC: "bcc@phase-n.invalid",
      NATORI_ACCEPTANCE_OUTBOX_ENABLED: "1", NATORI_NOTIFICATION_SENDING_ENABLED: "1", NATORI_DASHBOARD_KEY: randomBytes(32).toString("hex"), ADMIN_EMAILS: "" });
    const admin = createClient(origin, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const anon = createClient(origin, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    stage = "auth-fixture";
    const password = randomBytes(32).toString("hex");
    const auth = await admin.auth.admin.createUser({ email: "owner@phase-n.invalid", password, email_confirm: true });
    check(!auth.error && auth.data.user, "AUTH_FIXTURE");
    const owner = auth.data.user.id;
    process.env.NATORI_OWNER_USER_ID = owner;
    process.env.NATORI_OWNER_EMAILS = "owner@phase-n.invalid";
    const stranger = await admin.auth.admin.createUser({ email: "stranger@phase-n.invalid", password, email_confirm: true });
    check(!stranger.error && stranger.data.user, "STRANGER_AUTH");
    const user = createClient(origin, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    check(!(await user.auth.signInWithPassword({ email: "stranger@phase-n.invalid", password })).error, "REAL_AUTH_LOGIN");
    const { acceptNatoriQuote } = await import("../../src/features/natori/server/quoteAcceptService");
    const { acceptNatoriDelivery } = await import("../../src/features/natori/server/deliveryService");
    const { dispatchAcceptanceNotification, dispatchAcceptanceNotifications } = await import("../../src/features/natori/server/acceptanceNotifications");
    const routes = await import("../../src/app/api/natori/admin/notifications/route");
    const { NATORI_KEY_COOKIE } = await import("../../src/features/natori/constants/dashboardKey");
    const { deriveNatoriDashboardCookieToken } = await import("../../src/features/natori/lib/dashboardKeyToken");
    const jar = new Map([[NATORI_KEY_COOKIE, await deriveNatoriDashboardCookieToken(process.env.NATORI_DASHBOARD_KEY!)]]);
    const management = <T>(fn: () => Promise<T>) => cookieScope.run(new Map(jar), fn);
    const request = (id: string, csrf = true) => new Request("http://localhost/api/natori/admin/notifications", { method: "POST", headers: { "content-type": "application/json", ...(csrf ? { "x-requested-with": "me-ish" } : {}) }, body: JSON.stringify({ id }) });
    const hash = (token: string) => createHash("sha256").update(token).digest("hex");
    const future = () => new Date(Date.now() + 86400000).toISOString();
    const past = () => new Date(Date.now() - 3600000).toISOString();
    async function project(title = "Synthetic notification", userId = owner) {
      const token = randomBytes(24).toString("base64url");
      const result = await admin.from("natori_projects").insert({ user_id: userId, title, client_name: "Synthetic", client_email: "client@phase-n.invalid", amount: 12000, status: "delivered", type: "icon", payment_confirmed_at: past(), paid_at: past(), paid_amount: 12000, delivered_mail_at: past(), delivery_token_hash: hash(token), delivery_token_expires_at: future(), request_data: { preserved: true }, agreed_terms: { preserved: true } }).select("*").single();
      check(!result.error && result.data, "PROJECT_FIXTURE");
      return { id: String(result.data.id), token, row: result.data };
    }
    async function quote(title = "Synthetic quote") {
      const p = await project(title); const token = randomBytes(24).toString("base64url");
      const result = await admin.from("natori_quotes").insert({ project_id: p.id, user_id: owner, version: 1, title, client_name: "Synthetic", to_email: "client@phase-n.invalid", amount: 12000, subject: "Synthetic", body_snapshot: "Unchanged original", token_hash: hash(token), expires_at: future(), quote_terms: {}, pricing_snapshot: { items: [] } }).select("id").single();
      check(!result.error && result.data, "QUOTE_FIXTURE");
      check(!(await admin.from("natori_projects").update({ active_quote_id: result.data.id }).eq("id", p.id)).error, "ACTIVE_QUOTE");
      return { ...p, quoteId: String(result.data.id), token };
    }
    async function jobs(projectId: string) {
      const r = await admin.from("natori_notification_jobs").select("*").eq("project_id", projectId).order("attempt_no");
      check(!r.error && r.data, "READ_JOBS"); return r.data;
    }
    async function job(id: string) {
      const r = await admin.from("natori_notification_jobs").select("*").eq("id", id).single();
      check(!r.error && r.data, "READ_JOB"); return r.data;
    }
    async function reenable(id: string) {
      check(!(await admin.from("natori_notification_jobs").update({ lease_expires_at: past(), retry_after: past() }).eq("id", id)).error, "EXPIRE_LEASE");
    }
    stage = "schema-ready";
    for (let n = 0; n < 20; n++) {
      const probe = await admin.from("natori_notification_jobs").select("id").limit(1);
      if (!probe.error) break;
      check(n < 19, "SCHEMA_NOT_READY"); await new Promise(resolve => setTimeout(resolve, 250));
    }
    stage = "tests";
    await test("anon-and-real-auth-cannot-read-or-operate-notifications", async () => {
      for (const client of [anon, user]) {
        check(!!(await client.from("natori_notification_jobs").select("id")).error, "QUEUE_DISCLOSED");
        check(!!(await client.rpc("natori_accept_quote_with_notifications_v1", { p_token_hash: "0".repeat(64) })).error, "RPC_EXPOSED");
        check(!!(await client.rpc("natori_notification_claim_v1", { p_id: randomUUID(), p_claim_token: randomUUID() })).error, "CLAIM_EXPOSED");
        check(!!(await client.rpc("natori_notification_list_v1", { p_owner_id: owner })).error, "LIST_EXPOSED");
        check(!!(await client.rpc("natori_notification_retry_v1", { p_id: randomUUID(), p_owner_id: owner })).error, "RETRY_EXPOSED");
      }
    });
    await test("quote-race-one-business-fact-one-notice", async () => {
      const q = await quote(); const before = providerCalls;
      const values = await Promise.all(Array.from({ length: 6 }, () => acceptNatoriQuote(q.token)));
      check(values.filter(v => v.kind === "ok").length === 1 && values.filter(v => v.kind === "already-accepted").length === 5, "QUOTE_RACE_RESULT");
      const rows = await jobs(q.id); check(rows.length === 1 && rows[0].status === "pending", "QUOTE_DUPLICATE_JOB");
      check(providerCalls === before, "MAIL_INSIDE_ACCEPTANCE");
      const times = values.flatMap(v => "quote" in v ? [v.quote.acceptedAt] : []); check(new Set(times).size === 1, "TIMESTAMP_CHANGED");
      await Promise.all(Array.from({ length: 5 }, () => dispatchAcceptanceNotification(rows[0].id)));
      check((await job(rows[0].id)).status === "sent" && providerCalls === before + 1, "MULTIPLE_CLAIMS_SENT");
    });
    await test("delivery-race-completes-once-and-both-recipients-captured", async () => {
      const p = await project(); const before = providerCalls;
      const values = await Promise.all(Array.from({ length: 6 }, () => acceptNatoriDelivery(p.token)));
      check(values.filter(v => v.kind === "ok").length === 1 && values.every(v => ["ok", "already-accepted"].includes(v.kind)), "DELIVERY_RACE_RESULT");
      const rows = await jobs(p.id); check(rows.length === 2, "DELIVERY_JOB_COUNT");
      await dispatchAcceptanceNotifications(rows.map(r => r.id));
      check((await jobs(p.id)).every(r => r.status === "sent") && providerCalls === before + 2, "DELIVERY_CAPTURE");
      const after = await admin.from("natori_projects").select("*").eq("id", p.id).single();
      check(after.data?.status === "completed" && after.data.delivery_accepted_at === after.data.completed_at, "COMPLETION_NOT_ATOMIC");
      for (const field of ["paid_at", "paid_amount", "delivery_token_hash", "delivery_token_expires_at", "request_data", "agreed_terms"]) check(JSON.stringify(after.data[field]) === JSON.stringify(p.row[field]), "PROTECTED_FIELD_CHANGED");
      const activity = await admin.from("natori_project_activity").select("id").eq("project_id", p.id).eq("event_type", "delivery_accepted");
      check(activity.data?.length === 1, "ACTIVITY_DUPLICATED");
    });
    await test("quote-enqueue-failure-rolls-back-business-transaction", async () => {
      const q = await quote("FAIL_ENQUEUE_SYNTHETIC");
      check((await acceptNatoriQuote(q.token)).kind === "db-error", "ENQUEUE_FAILURE_FALSE_SUCCESS");
      const row = await admin.from("natori_quotes").select("accepted_at").eq("id", q.quoteId).single();
      check(row.data?.accepted_at === null && (await jobs(q.id)).length === 0, "QUOTE_PARTIAL_COMMIT");
    });
    await test("delivery-enqueue-failure-rolls-back-business-and-activity", async () => {
      const p = await project("FAIL_ENQUEUE_SYNTHETIC");
      check((await acceptNatoriDelivery(p.token)).kind === "db-error", "ENQUEUE_FAILURE_FALSE_SUCCESS");
      const row = await admin.from("natori_projects").select("status,delivery_accepted_at,completed_at").eq("id", p.id).single();
      const activity = await admin.from("natori_project_activity").select("id").eq("project_id", p.id);
      check(row.data?.status === "delivered" && row.data.delivery_accepted_at === null && row.data.completed_at === null && activity.data?.length === 0, "DELIVERY_PARTIAL_COMMIT");
    });
    await test("lost-quote-commit-response-reconciles-original-fact", async () => {
      const q = await quote(); loseAcceptance = true;
      const r = await acceptNatoriQuote(q.token);
      check(r.kind === "already-accepted" && !!r.quote.acceptedAt && (await jobs(q.id)).length === 1, "QUOTE_RECONCILIATION");
    });
    await test("lost-delivery-commit-response-reconciles-original-fact", async () => {
      const p = await project(); loseAcceptance = true;
      check((await acceptNatoriDelivery(p.token)).kind === "already-accepted" && (await jobs(p.id)).length === 2, "DELIVERY_RECONCILIATION");
    });
    await test("precommit-db-failure-never-returns-success", async () => {
      const q = await quote(); rejectAcceptance = true; check((await acceptNatoriQuote(q.token)).kind === "db-error", "FALSE_SUCCESS");
      const p = await project(); rejectAcceptance = true; check((await acceptNatoriDelivery(p.token)).kind === "db-error", "FALSE_SUCCESS");
      check((await jobs(p.id)).length === 0 && (await jobs(q.id)).length === 0, "FALSE_ENQUEUE");
    });
    await test("historical-accepted-rows-do-not-enqueue-or-resend", async () => {
      const q = await quote(); const p = await project();
      check(!(await admin.rpc("natori_accept_quote", { p_token_hash: hash(q.token) })).error, "OLD_QUOTE_RPC");
      check(!(await admin.rpc("natori_accept_delivery_v1", { p_token_hash: hash(p.token) })).error, "OLD_DELIVERY_RPC");
      check((await acceptNatoriQuote(q.token)).kind === "already-accepted" && (await acceptNatoriDelivery(p.token)).kind === "already-accepted", "OLD_COMPATIBILITY");
      check((await jobs(q.id)).length === 0 && (await jobs(p.id)).length === 0, "HISTORICAL_REENQUEUE");
    });
    await test("existing-unpaid-expired-archived-guards-survive-new-wrapper", async () => {
      for (const patch of [{ payment_confirmed_at: null }, { delivery_token_expires_at: past() }, { deleted_at: past() }, { delivered_mail_at: null }]) {
        const p = await project(); await admin.from("natori_projects").update(patch).eq("id", p.id);
        check(!["ok", "already-accepted"].includes((await acceptNatoriDelivery(p.token)).kind) && (await jobs(p.id)).length === 0, "DELIVERY_GUARD_LOST");
      }
    });
    await test("provider-rejection-retry-only-mail-preserves-completion", async () => {
      const p = await project(); await acceptNatoriDelivery(p.token); const rows = await jobs(p.id), id = rows[0].id;
      const before = (await admin.from("natori_projects").select("*").eq("id", p.id).single()).data;
      mode = "reject"; await dispatchAcceptanceNotification(id); check((await job(id)).status === "failed", "REJECTION_STATUS");
      const retry = await management(() => routes.POST(request(id))); check(retry.status === 200, "MANAGED_RETRY_FAILED");
      const attempts = await jobs(p.id); check(attempts.length === 3 && attempts.some(j => j.attempt_no === 2 && j.status === "sent") && (await job(id)).status === "failed", "ATTEMPT_HISTORY_LOST");
      const after = (await admin.from("natori_projects").select("*").eq("id", p.id).single()).data;
      check(JSON.stringify(before) === JSON.stringify(after), "RETRY_CHANGED_BUSINESS");
    });
    await test("provider-success-response-lost-replays-same-key-and-payload", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id;
      const count = accepted.size; mode = "drop"; await dispatchAcceptanceNotification(id);
      check((await job(id)).status === "unknown" && accepted.size === count + 1, "UNKNOWN_NOT_TRACKED");
      await admin.from("natori_quotes").update({ title: "Changed later" }).eq("id", q.quoteId);
      const originalFrom = process.env.NATORI_ORDER_MAIL_FROM; process.env.NATORI_ORDER_MAIL_FROM = "changed-invalid";
      await reenable(id); await dispatchAcceptanceNotification(id, true); process.env.NATORI_ORDER_MAIL_FROM = originalFrom;
      check((await job(id)).status === "sent" && accepted.size === count + 1, "UNKNOWN_DUPLICATE_DELIVERY");
    });
    await test("provider-accepted-db-save-lost-recovers-after-lease", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id;
      const count = accepted.size; dropFinish = true; await dispatchAcceptanceNotification(id);
      check((await job(id)).status === "sending", "SAVE_FAILURE_NOT_RETAINED");
      await reenable(id); await dispatchAcceptanceNotification(id, true);
      check((await job(id)).status === "sent" && accepted.size === count + 1, "SAVE_LOSS_DUPLICATE");
    });
    await test("replay-credential-failure-does-not-erase-an-unknown-send", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id;
      mode = "drop"; await dispatchAcceptanceNotification(id); await reenable(id);
      delete process.env.RESEND_API_KEY;
      try { await dispatchAcceptanceNotification(id, true); } finally { process.env.RESEND_API_KEY = apiKey; }
      check((await job(id)).status === "unknown", "UNKNOWN_REPLACED_WITH_FAILURE");
      const retry = await admin.rpc("natori_notification_retry_v1", { p_id: id, p_owner_id: owner });
      check(retry.data === id && (await jobs(q.id)).length === 1, "UNKNOWN_KEY_REPLACED");
    });
    await test("stopped-worker-before-send-and-stale-fence", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id, old = randomUUID(), next = randomUUID();
      check((await admin.rpc("natori_notification_claim_v1", { p_id: id, p_claim_token: old })).data?.length === 1, "FIRST_CLAIM");
      check((await admin.rpc("natori_notification_claim_v1", { p_id: id, p_claim_token: next })).data?.length === 0, "LIVE_LEASE_STOLEN");
      await reenable(id); check((await admin.rpc("natori_notification_claim_v1", { p_id: id, p_claim_token: next })).data?.length === 1, "LEASE_RECOVERY");
      check((await admin.rpc("natori_notification_finish_v1", { p_id: id, p_claim_token: old, p_status: "failed", p_error_code: "stale" })).data === false, "STALE_WORKER_OVERWRITE");
      check((await admin.rpc("natori_notification_start_v1", { p_id: id, p_claim_token: old, p_payload: { test: true } })).data?.length === 0, "STALE_WORKER_STARTED_SEND");
      await reenable(id); await dispatchAcceptanceNotification(id, true); check((await job(id)).status === "sent", "STOPPED_WORKER_NOT_RECOVERED");
    });
    await test("old-unknown-outside-key-window-does-not-contact-provider", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const original = (await jobs(q.id))[0];
      const id = randomUUID(); const inserted = await admin.from("natori_notification_jobs").insert({ id, notification_key: `test-aged/${id}`, project_id: q.id, purpose: original.purpose, snapshot: original.snapshot, status: "unknown", send_started_at: new Date(Date.now() - 25 * 3600000).toISOString() });
      check(!inserted.error, "OLD_UNKNOWN_FIXTURE"); const before = providerCalls;
      await dispatchAcceptanceNotification(id, true); check(providerCalls === before && (await job(id)).error_code === "review_required", "EXPIRED_KEY_RESENT");
    });
    await test("immutable-evidence-and-sent-timestamp-survive-invalid-retry", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id;
      await dispatchAcceptanceNotification(id); const before = await job(id);
      check(!!(await admin.from("natori_notification_jobs").update({ payload: { changed: true } }).eq("id", id)).error, "PAYLOAD_MUTATED");
      check(!!(await admin.from("natori_notification_jobs").update({ snapshot: { changed: true } }).eq("id", id)).error, "SNAPSHOT_MUTATED");
      check((await admin.rpc("natori_notification_retry_v1", { p_id: id, p_owner_id: owner })).data === null, "SENT_RETRIED");
      check(JSON.stringify(before) === JSON.stringify(await job(id)), "SUCCESS_EVIDENCE_LOST");
    });
    await test("retry-race-creates-one-new-attempt", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id;
      mode = "reject"; await dispatchAcceptanceNotification(id);
      const retries = await Promise.all(Array.from({ length: 5 }, () => admin.rpc("natori_notification_retry_v1", { p_id: id, p_owner_id: owner })));
      check(retries.every(r => !r.error) && new Set(retries.map(r => r.data)).size === 1 && (await jobs(q.id)).length === 2, "RETRY_RACE_DUPLICATE");
    });
    await test("automatic-and-manual-retry-budgets-are-bounded", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id;
      for (let i = 0; i < 3; i++) { await reenable(id); check((await admin.rpc("natori_notification_claim_v1", { p_id: id, p_claim_token: randomUUID() })).data?.length === 1, "CLAIM_BUDGET_SETUP"); }
      await reenable(id); check((await admin.rpc("natori_notification_claim_v1", { p_id: id, p_claim_token: randomUUID() })).data?.length === 0, "AUTO_BUDGET_EXCEEDED");
      for (let i = 3; i < 8; i++) { await reenable(id); check((await admin.rpc("natori_notification_claim_v1", { p_id: id, p_claim_token: randomUUID(), p_manual: true })).data?.length === 1, "MANUAL_BUDGET_SETUP"); }
      await reenable(id); const before = providerCalls; await dispatchAcceptanceNotification(id, true);
      check(providerCalls === before && (await job(id)).error_code === "review_required", "MANUAL_BUDGET_EXCEEDED");
    });
    await test("management-auth-csrf-owner-and-response-redaction", async () => {
      const p = await project("Foreign", stranger.data.user!.id); await acceptNatoriDelivery(p.token); const id = (await jobs(p.id))[0].id;
      check((await cookieScope.run(new Map(), () => routes.GET())).status === 401, "ANON_ADMIN_ALLOWED");
      check((await management(() => routes.POST(request(id, false)))).status === 403, "CSRF_ALLOWED");
      check((await management(() => routes.POST(request(id)))).status === 409, "FOREIGN_RETRY_ALLOWED");
      const response = await management(() => routes.GET()); check(response.status === 200, "MANAGED_LIST");
      const text = await response.text();
      check(!text.includes(p.id) && !/@phase-n.invalid|provider_id|payload|snapshot|token_hash|claim_token/.test(text), "PRIVATE_DETAILS_EXPOSED");
    });
    await test("pause-sending-keeps-pending-job-and-business-fact", async () => {
      const q = await quote(); await acceptNatoriQuote(q.token); const id = (await jobs(q.id))[0].id, before = providerCalls;
      process.env.NATORI_NOTIFICATION_SENDING_ENABLED = "0"; await dispatchAcceptanceNotification(id); process.env.NATORI_NOTIFICATION_SENDING_ENABLED = "1";
      check((await job(id)).status === "pending" && providerCalls === before, "PAUSE_SENT_MAIL");
    });
    await test("management-pagination-keeps-old-pending-before-success-history", async () => {
      const p = await project(); const initial = randomUUID(), stamp = past();
      const batch = [{ id: initial, notification_key: `pagination/${initial}`, project_id: p.id, purpose: "quote_accept_artist", snapshot: {}, status: "pending", created_at: stamp },
        ...Array.from({ length: 55 }, () => { const id = randomUUID(); return { id, notification_key: `pagination/${id}`, project_id: p.id, purpose: "quote_accept_artist", snapshot: {}, status: "sent", provider_id: randomUUID(), sent_at: new Date().toISOString() }; })];
      check(!(await admin.from("natori_notification_jobs").insert(batch)).error, "PAGINATION_FIXTURE");
      const first = await admin.rpc("natori_notification_list_v1", { p_owner_id: owner, p_offset: 0 });
      const second = await admin.rpc("natori_notification_list_v1", { p_owner_id: owner, p_offset: 50 });
      check(!first.error && !second.error && first.data.length === 51 && second.data.length > 0, "PAGINATION_FAILED");
      check(first.data.some((r: { id: string }) => r.id === initial), "PENDING_HIDDEN_BY_HISTORY");
      const ids = [...first.data.slice(0, 50), ...second.data].map((r: { id: string }) => r.id);
      check(new Set(ids).size === ids.length, "PAGINATION_DUPLICATE");
    });
    writeFileSync("/results/phasen.json", JSON.stringify({ tests: results, passed: results.filter(r => r.status === "passed").length, failed: results.filter(r => r.status === "failed").length, skipped: 0, provider: "sealed-http-capture-not-real-resend", providerRequests: providerCalls, distinctAcceptedMessages: accepted.size }, null, 2));
    console.log(`PHASE N ${results.filter(r => r.status === "passed").length} passed / ${results.filter(r => r.status === "failed").length} failed / 0 skipped`);
    check(results.length >= 20 && results.every(r => r.status === "passed"), "MANDATORY_TEST_FAILED");
  } finally { globalThis.fetch = realFetch; await new Promise<void>(resolve => capture.close(() => resolve())); }
}
main().catch(() => { console.error(`Phase N failed at ${stage}; no raw errors/credentials published`); process.exitCode = 1; });
