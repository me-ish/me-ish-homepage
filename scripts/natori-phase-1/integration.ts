import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import { DELIVERY_MAX_BYTES } from "../../src/features/natori/lib/deliveryIntegrity";
import { cookieScope } from "../natori-phase-0b/cookies";

const check: (value: unknown, code: string) => asserts value = (value, code) => { if (!value) throw new Error(code); };
const results: { name: string; status: string; code?: string }[] = [];
const tusDiagnostics: { status: number; originAllowed: boolean; protocol: string; hostMatches: boolean }[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ name, status: "passed" }); console.log(`PASS phase1/${name}`); }
  catch (e) { const code = e instanceof Error && /^[A-Z_0-9]+$/.test(e.message) ? e.message : "ASSERTION_FAILED";
    results.push({ name, status: "failed", code }); console.log(`FAIL phase1/${name} ${code}`); }
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const past = () => new Date(Date.now() - 3600000).toISOString();
let stage = "preflight";
async function main() {
  const { origin } = JSON.parse(readFileSync("/runtime/network.json", "utf8"));
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), "DESTINATION_REJECTED");
  const keys = JSON.parse(readFileSync("/runtime/credentials.json", "utf8"));
  const accepted = new Map<string, { body: string; id: string }>();
  let mode = "accept", calls = 0, blockedCalls = 0;
  let loseIssue = false, rejectIssue = false, loseFinalize = false, loseAccept = false, rejectAccept = false, loseFinish = false;
  let failStorageRead = false, failStorageSign = false, failStorageDelete = false;
  const apiKey = randomBytes(32).toString("hex");
  const capture = createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    try {
      const payload = JSON.parse(body), key = String(request.headers["idempotency-key"] ?? "");
      check(request.method === "POST" && request.url === "/emails" && request.headers.authorization === `Bearer ${apiKey}`, "CAPTURE_AUTH");
      check(payload.from === "Phase 1 <sender@phase-1.invalid>"
        && [...payload.to, ...(payload.bcc ?? []), payload.reply_to].every(a => ["client@phase-1.invalid", "artist@phase-1.invalid", "bcc@phase-1.invalid"].includes(a)), "RECIPIENT_ALLOWLIST");
      calls++;
      const previous = accepted.get(key);
      if (previous) { response.writeHead(previous.body === body ? 200 : 409); response.end(JSON.stringify({ id: previous.id })); return; }
      const next = mode; mode = "accept";
      if (next === "reject") { response.writeHead(422); response.end("{}"); return; }
      const id = randomUUID(); accepted.set(key, { body, id });
      if (next === "drop") { response.destroy(); return; }
      response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ id }));
    } catch { response.writeHead(400); response.end("{}"); }
  });
  await new Promise<void>(resolve => capture.listen(3101, "127.0.0.1", resolve));
  const direct = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.href === "https://api.resend.com/emails") return direct("http://127.0.0.1:3101/emails", init);
    if (url.origin !== origin || url.username || url.password) { blockedCalls++; throw new Error("DESTINATION_REJECTED"); }
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if ((failStorageRead && method === "GET" && url.pathname.includes("/storage/v1/object/sign/"))
      || (failStorageSign && method === "POST" && url.pathname.includes("/storage/v1/object/sign/"))
      || (failStorageDelete && method === "DELETE" && url.pathname.includes("/storage/v1/object/"))) {
      failStorageRead = failStorageSign = failStorageDelete = false; return new Response("{}", { status: 503 });
    }
    const issue = url.pathname.endsWith("/rpc/natori_delivery_issue_v1"), accept = url.pathname.endsWith("/rpc/natori_accept_delivery_ready_v1");
    if ((issue && rejectIssue) || (accept && rejectAccept)) { rejectIssue = rejectAccept = false; return new Response("{}", { status: 503 }); }
    if (url.pathname.endsWith("/rpc/natori_notification_finish_v1") && loseFinish) { loseFinish = false; return new Response("{}", { status: 503 }); }
    const response = await direct(input, init);
    if ((issue && loseIssue) || (accept && loseAccept) || (url.pathname.endsWith("/rpc/natori_delivery_finalize_v1") && loseFinalize)) {
      loseIssue = loseAccept = loseFinalize = false; check(response.ok, "COMMIT_BEFORE_RESPONSE_LOSS"); return new Response("{}", { status: 503 });
    }
    return response;
  };
  try {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service,
      RESEND_API_KEY: apiKey, NATORI_ORDER_MAIL_FROM: "Phase 1 <sender@phase-1.invalid>", NATORI_PORTFOLIO_CONTACT_TO: "artist@phase-1.invalid", NATORI_MAIL_BCC: "bcc@phase-1.invalid",
      NATORI_ACCEPTANCE_OUTBOX_ENABLED: "1", NATORI_NOTIFICATION_SENDING_ENABLED: "1", NATORI_DELIVERY_INTEGRITY_ENABLED: "1",
      NATORI_DELIVERY_NOTIFICATION_KEY: randomBytes(32).toString("hex"), NATORI_DASHBOARD_KEY: randomBytes(32).toString("hex"), ADMIN_EMAILS: "" });
    const admin = createClient(origin, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const anon = createClient(origin, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const password = randomBytes(32).toString("hex");
    const created = await admin.auth.admin.createUser({ email: "owner@phase-1.invalid", password, email_confirm: true });
    check(!created.error && created.data.user, "OWNER_AUTH"); const owner = created.data.user.id;
    process.env.NATORI_OWNER_USER_ID = owner; process.env.NATORI_OWNER_EMAILS = "owner@phase-1.invalid";
    const stranger = await admin.auth.admin.createUser({ email: "stranger@phase-1.invalid", password, email_confirm: true });
    check(!stranger.error && stranger.data.user, "STRANGER_AUTH");
    const user = createClient(origin, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    check(!(await user.auth.signInWithPassword({ email: "stranger@phase-1.invalid", password })).error, "AUTH_LOGIN");
    const files = await import("../../src/features/natori/server/deliveryService");
    const ready = await import("../../src/features/natori/server/deliveryFilesService");
    const release = await import("../../src/features/natori/server/deliveryReleaseService");
    const notices = await import("../../src/features/natori/server/acceptanceNotifications");
    const { NATORI_KEY_COOKIE } = await import("../../src/features/natori/constants/dashboardKey");
    const { deriveNatoriDashboardCookieToken } = await import("../../src/features/natori/lib/dashboardKeyToken");
    const jar = new Map([[NATORI_KEY_COOKIE, await deriveNatoriDashboardCookieToken(process.env.NATORI_DASHBOARD_KEY!)]]);
    const manage = <T>(fn: () => Promise<T>) => cookieScope.run(new Map(jar), fn);
    async function project(title = "Synthetic Phase 1", patch: Record<string, unknown> = {}) {
      const row = await admin.from("natori_projects").insert({ user_id: owner, title, client_name: "Synthetic", client_email: "client@phase-1.invalid",
        amount: 12000, type: "icon", status: "delivery_prep", payment_confirmed_at: past(), paid_at: past(), paid_amount: 12000,
        request_data: { unchanged: true }, agreed_terms: { unchanged: true }, ...patch }).select("*").single();
      check(!row.error && row.data, "PROJECT_FIXTURE"); return row.data;
    }
    async function reserve(pid: string, bytes = 23, mime = "application/octet-stream", id = randomUUID()) {
      const result = await manage(() => files.signNatoriDeliveryUpload({ projectId: pid, folder: "final", fileName: `${id}.bin`, sizeBytes: bytes, contentType: mime, fileId: id }));
      check(result.kind === "ok", "RESERVATION"); return result;
    }
    async function upload(pid: string, bytes = Buffer.from("synthetic delivery data!")) {
      const signed = await reserve(pid, bytes.length);
      check(!(await admin.storage.from("natori-deliveries").uploadToSignedUrl(signed.path, signed.token, bytes, { contentType: "application/octet-stream" })).error, "SIGNED_UPLOAD");
      check(await manage(() => ready.finalizeDeliveryFile(signed.fileId)) === "ready", "FINALIZE");
      return { ...signed, bytes };
    }
    const input = (pid: string, ids: string[], operationId = randomUUID()) => ({ projectId: pid, fileIds: ids, operationId,
      to: "client@phase-1.invalid", subject: "Synthetic delivery", body: "Synthetic files\n{納品リンク}" });
    const issue = (value: ReturnType<typeof input>) => manage(() => release.issueReadyDelivery(value));
    async function row(pid: string) { const r = await admin.from("natori_projects").select("*").eq("id", pid).single(); check(!r.error && r.data, "PROJECT_READ"); return r.data; }
    async function jobs(pid: string) { const r = await admin.from("natori_notification_jobs").select("*").eq("project_id", pid).order("created_at"); check(!r.error && r.data, "JOBS_READ"); return r.data; }
    async function token(pid: string) {
      const id = (await jobs(pid)).find(j => j.purpose === "delivery_issue_client" && j.status === "sent")?.id;
      check(id, "NOTICE_SENT"); const body = accepted.get(`natori-notice/${id}`)?.body; check(body, "CAPTURE_BODY");
      const match = JSON.parse(body).text.match(/\/natori\/delivery\/([A-Za-z0-9_-]{20,64})/); check(match, "CAPTURE_TOKEN"); return String(match[1]);
    }
    stage = "tests";
    await test("production-destination-stops-before-network", async () => {
      for (const destination of ["https://production-example.supabase.co", "https://www.me-ish.art", "http://127.0.0.1:55431"]) {
        let denied = false; try { await fetch(destination); } catch { denied = true; } check(denied, "PRODUCTION_NOT_DENIED");
      }
      check(blockedCalls === 3, "GUARD_COUNT");
    });
    await test("anon-and-real-auth-cannot-read-release-access-or-use-rpcs", async () => {
      for (const client of [anon, user]) {
        for (const table of ["natori_delivery_releases", "natori_delivery_access", "natori_delivery_operations"]) check(!!(await client.from(table).select("*")).error, "TABLE_DISCLOSED");
        check(!!(await client.rpc("natori_delivery_delete_v1", { p_owner_id: owner, p_file_id: randomUUID() })).error, "RPC_EXPOSED");
        check(!!(await client.rpc("natori_accept_delivery_ready_v1", { p_token_hash: "0".repeat(64), p_release_id: randomUUID(), p_manifest: [], p_verified_at: new Date().toISOString() })).error, "ACCEPT_EXPOSED");
      }
    });
    await test("reservation-replay-and-concurrent-ten-file-limit", async () => {
      const p = await project(), id = randomUUID(); const a = await reserve(p.id, 23, "application/octet-stream", id);
      const b = await reserve(p.id, 23, "application/octet-stream", id); check(a.fileId === b.fileId && a.path === b.path, "RESERVE_DUPLICATE");
      const attempts = await Promise.all(Array.from({ length: 12 }, () => manage(() => files.signNatoriDeliveryUpload({ projectId: p.id, folder: "final", fileName: "synthetic.bin", sizeBytes: 23 }))));
      check(attempts.filter(r => r.kind === "ok").length === 9 && attempts.filter(r => r.kind === "too-many-files").length === 3, "COUNT_RACE");
    });
    await test("empty-and-reserved-but-not-uploaded-cannot-publish", async () => {
      const p = await project(), f = await reserve(p.id);
      check((await issue(input(p.id, []))).kind === "invalid-state", "EMPTY_PUBLISHED");
      check(await manage(() => ready.finalizeDeliveryFile(f.fileId)) === "unavailable", "MISSING_READY");
      check((await issue(input(p.id, [f.fileId]))).kind === "no-files" && (await jobs(p.id)).length === 0, "PHANTOM_PUBLISHED");
    });
    await test("actual-size-and-mime-mismatch-do-not-finalize", async () => {
      const p = await project();
      for (const [size, mime, actualMime] of [[12, "application/octet-stream", "application/octet-stream"], [23, "image/png", "application/octet-stream"]] as const) {
        const f = await reserve(p.id, size, mime); await admin.storage.from("natori-deliveries").uploadToSignedUrl(f.path, f.token, Buffer.alloc(23), { contentType: actualMime });
        check(await manage(() => ready.finalizeDeliveryFile(f.fileId)) === "unavailable", "INVALID_READY");
      }
    });
    await test("finalize-commit-response-loss-retries-same-row", async () => {
      const p = await project(), f = await reserve(p.id); await admin.storage.from("natori-deliveries").uploadToSignedUrl(f.path, f.token, Buffer.alloc(23), { contentType: "application/octet-stream" });
      loseFinalize = true; check(await manage(() => ready.finalizeDeliveryFile(f.fileId)) === "db-error", "FINALIZE_RESPONSE_LOSS");
      check(await manage(() => ready.finalizeDeliveryFile(f.fileId)) === "ready", "FINALIZE_RECOVERY");
      const list = await files.getNatoriDeliveryByToken("short"); check(list.kind === "not-found", "BAD_TOKEN");
    });
    await test("normal-signed-upload-read-bytes-and-single-publication", async () => {
      const p = await project(), f = await upload(p.id), op = input(p.id, [f.fileId]);
      const issued = await issue(op); check(issued.kind === "ok" && issued.notificationStatus === "sent", "ISSUE");
      const t = await token(p.id), before = await row(p.id), view = await files.getNatoriDeliveryByToken(t);
      check(view.kind === "ok" && view.delivery.canAccept && view.delivery.files.length === 1 && view.delivery.files[0].url, "READINESS");
      const bytes = await (await fetch(view.delivery.files[0].url)).arrayBuffer(); check(Buffer.from(bytes).equals(f.bytes), "FILE_BYTES");
      check(JSON.stringify(before) === JSON.stringify(await row(p.id)), "GET_MUTATED_PROJECT");
      const replay = await issue(op); check(replay.kind === "ok" && replay.releaseId === issued.releaseId && (await jobs(p.id)).length === 1, "ISSUE_REPLAY");
      check((await issue({ ...op, subject: "Different input" })).kind === "delivery-conflict", "HASH_CONFLICT");
    });
    await test("publication-commit-response-loss-reconciles-saved-operation", async () => {
      const p = await project(), f = await upload(p.id); loseIssue = true; const op = input(p.id, [f.fileId]);
      check((await issue(op)).kind === "ok" && (await issue(op)).kind === "ok" && (await jobs(p.id)).length === 1, "ISSUE_RESPONSE_LOSS");
    });
    await test("publication-precommit-db-error-does-not-create-link-or-mail", async () => {
      const p = await project(), f = await upload(p.id); rejectIssue = true; const count = accepted.size;
      check((await issue(input(p.id, [f.fileId]))).kind === "db-error" && (await jobs(p.id)).length === 0 && accepted.size === count && (await row(p.id)).delivery_token_hash === null, "FALSE_ISSUE_SUCCESS");
    });
    await test("concurrent-publication-and-deletion-have-one-safe-winner", async () => {
      const p = await project(), f = await upload(p.id);
      const [published, deleted] = await Promise.all([issue(input(p.id, [f.fileId])), manage(() => files.deleteNatoriDeliveryFile(f.fileId))]);
      check(!(published.kind === "ok" && deleted), "DELETE_PUBLISH_BOTH_SUCCEEDED");
      if (published.kind === "ok") check((await files.getNatoriDeliveryByToken(await token(p.id))).kind === "ok", "PUBLISHED_READ_LOST");
      else check((await jobs(p.id)).length === 0, "FAILED_ISSUE_SENT");
    });
    await test("published-file-cannot-delete-overwrite-or-add-final-file", async () => {
      const p = await project(), f = await upload(p.id); await issue(input(p.id, [f.fileId]));
      check(!await manage(() => files.deleteNatoriDeliveryFile(f.fileId)), "PUBLISHED_API_DELETE");
      check(!!(await admin.from("natori_delivery_files").delete().eq("id", f.fileId)).error, "PUBLISHED_DB_DELETE");
      check(!!(await admin.from("natori_delivery_files").update({ file_name: "changed" }).eq("id", f.fileId)).error, "PUBLISHED_DB_EDIT");
      check(!!(await admin.storage.from("natori-deliveries").uploadToSignedUrl(f.path, f.token, Buffer.alloc(23), { contentType: "application/octet-stream" })).error, "SIGNED_OVERWRITE");
      check((await manage(() => files.signNatoriDeliveryUpload({ projectId: p.id, folder: "final", fileName: "new.bin", sizeBytes: 23 }))).kind === "invalid-state", "PUBLISHED_NEW_FILE");
    });
    await test("partial-missing-file-is-visible-and-acceptance-is-rejected", async () => {
      const p = await project(), a = await upload(p.id), b = await upload(p.id); await issue(input(p.id, [a.fileId, b.fileId]));
      const t = await token(p.id); await admin.storage.from("natori-deliveries").remove([b.path]);
      const view = await files.getNatoriDeliveryByToken(t); check(view.kind === "ok" && !view.delivery.canAccept
        && view.delivery.files.length === 2 && view.delivery.files.filter(f => f.available).length === 1, "PARTIAL_HIDDEN");
      check((await files.acceptNatoriDelivery(t)).kind === "files-unavailable" && (await row(p.id)).delivery_accepted_at === null, "MISSING_ACCEPTED");
    });
    await test("legacy-rpc-cannot-bypass-fresh-manifest-proof", async () => {
      const p = await project(), f = await upload(p.id); await issue(input(p.id, [f.fileId])); const t = await token(p.id);
      for (const rpc of ["natori_accept_delivery_v1", "natori_accept_delivery_with_notifications_v1"]) {
        const r = await admin.rpc(rpc, { p_token_hash: hash(t) }); check(!r.error && r.data?.[0]?.result === "unavailable", "OLD_RPC_BYPASS");
      }
      check((await row(p.id)).delivery_accepted_at === null, "OLD_RPC_COMPLETED");
    });
    await test("ready-row-with-missing-object-cannot-publish", async () => {
      const p = await project(), f = await upload(p.id); await admin.storage.from("natori-deliveries").remove([f.path]);
      check((await issue(input(p.id, [f.fileId]))).kind === "no-files" && (await jobs(p.id)).length === 0
        && (await row(p.id)).delivery_token_hash === null, "READY_PHANTOM_PUBLISHED");
    });
    await test("storage-download-and-signature-failure-block-acceptance-without-state-change", async () => {
      const p = await project(), f = await upload(p.id); await issue(input(p.id, [f.fileId])); const t = await token(p.id), before = await row(p.id);
      failStorageRead = true; check((await files.acceptNatoriDelivery(t)).kind === "files-unavailable", "STORAGE_FAILURE_ACCEPTED");
      failStorageSign = true; const unavailable = await files.getNatoriDeliveryByToken(t);
      check(unavailable.kind === "ok" && !unavailable.delivery.canAccept && unavailable.delivery.files.length === 1, "SIGN_FAILURE_HIDDEN");
      check(JSON.stringify(before) === JSON.stringify(await row(p.id)), "STORAGE_FAILURE_MUTATED");
      const recovered = await files.getNatoriDeliveryByToken(t); check(recovered.kind === "ok" && recovered.delivery.canAccept, "TRANSIENT_NOT_RECOVERED");
    });
    await test("stale-proof-and-manifest-version-change-cannot-complete", async () => {
      const p = await project(), f = await upload(p.id); await issue(input(p.id, [f.fileId])); const t = await token(p.id);
      const releaseRow = (await admin.from("natori_delivery_releases").select("*").eq("project_id", p.id).single()).data;
      const denied = await admin.rpc("natori_accept_delivery_ready_v1", { p_token_hash: hash(t), p_release_id: releaseRow.id,
        p_manifest: releaseRow.manifest, p_verified_at: past() });
      check(!denied.error && denied.data?.[0]?.result === "unavailable", "STALE_PROOF_ACCEPTED");
      check(!!(await admin.from("natori_delivery_releases").update({ revision: 2 }).eq("id", releaseRow.id)).error, "MANIFEST_CHANGED");
      check(!(await admin.storage.from("natori-deliveries").update(f.path, f.bytes, { contentType: "application/octet-stream" })).error, "EXTERNAL_OVERWRITE_FIXTURE");
      check((await files.acceptNatoriDelivery(t)).kind === "files-unavailable" && (await row(p.id)).delivery_accepted_at === null, "REPLACED_FILE_ACCEPTED");
    });
    await test("expired-legacy-link-is-not-reissued-or-extended", async () => {
      const t = randomBytes(24).toString("base64url"), p = await project("Expired legacy", { status: "delivered",
        delivery_token_hash: hash(t), delivery_token_expires_at: past(), delivered_mail_at: past() });
      const f = await upload(p.id), before = await row(p.id);
      check((await files.getNatoriDeliveryByToken(t)).kind === "expired" && (await files.acceptNatoriDelivery(t)).kind === "expired", "EXPIRED_ACCESS");
      check((await issue(input(p.id, [f.fileId]))).kind === "delivery-expired" && (await jobs(p.id)).length === 0
        && JSON.stringify(before) === JSON.stringify(await row(p.id)), "EXPIRED_RENEWED");
    });
    await test("storage-deletion-failure-retains-tombstone-and-retries-only-delete", async () => {
      const p = await project(), f = await upload(p.id); failStorageDelete = true;
      check(!await manage(() => files.deleteNatoriDeliveryFile(f.fileId)), "FAILED_DELETE_SUCCESS");
      const pending = (await admin.from("natori_delivery_files").select("*").eq("id", f.fileId).single()).data;
      check(pending.state === "deleting" && !pending.deleted_at && (await issue(input(p.id, [f.fileId]))).kind === "no-files", "DELETE_TOMBSTONE_LOST");
      check(await manage(() => files.deleteNatoriDeliveryFile(f.fileId)), "DELETE_RECOVERY");
      const deleted = (await admin.from("natori_delivery_files").select("*").eq("id", f.fileId).single()).data;
      check(deleted.deleted_at && (await manage(() => files.listNatoriDeliveryFiles(p.id)))?.length === 0, "DELETED_STILL_VISIBLE");
      const list = await admin.storage.from("natori-deliveries").list(`${p.id}/final`); check(!list.error && list.data.length === 0, "DELETE_BYTES_REMAIN");
    });
    await test("notification-failure-does-not-undo-published-delivery", async () => {
      const p = await project(), f = await upload(p.id); mode = "reject";
      const published = await issue(input(p.id, [f.fileId])); check(published.kind === "ok" && published.notificationStatus === "failed", "MAIL_ROLLBACK");
      check((await row(p.id)).status === "delivered" && (await row(p.id)).delivered_mail_at === null, "BUSINESS_MAIL_MIXED");
      const [job] = await jobs(p.id); const retried = await admin.rpc("natori_notification_retry_v1", { p_id: job.id, p_owner_id: owner });
      check(retried.data, "MAIL_RETRY"); await notices.dispatchAcceptanceNotification(retried.data, true);
      check((await row(p.id)).status === "delivered" && !!(await row(p.id)).delivered_mail_at, "MAIL_RETRY_CHANGED_STATUS");
    });
    await test("unknown-provider-response-recovers-original-key-and-encrypted-payload", async () => {
      const p = await project(), f = await upload(p.id); mode = "drop"; const op = input(p.id, [f.fileId]); const published = await issue(op);
      check(published.kind === "ok" && published.notificationStatus === "unknown", "UNKNOWN_STATE");
      const before = accepted.size, [job] = await jobs(p.id);
      check(!JSON.stringify(job).includes("/natori/delivery/"), "TOKEN_IN_DB");
      await admin.from("natori_notification_jobs").update({ retry_after: past(), lease_expires_at: past() }).eq("id", job.id);
      const original = process.env.NATORI_ORDER_MAIL_FROM; process.env.NATORI_ORDER_MAIL_FROM = "changed-invalid";
      const replay = await issue(op); process.env.NATORI_ORDER_MAIL_FROM = original;
      check(replay.kind === "ok" && replay.notificationStatus === "sent" && accepted.size === before && (await jobs(p.id)).length === 1, "UNKNOWN_DUPLICATE");
    });
    await test("provider-success-db-finish-loss-recovers-without-duplicate", async () => {
      const p = await project(), f = await upload(p.id); loseFinish = true; const op = input(p.id, [f.fileId]); await issue(op);
      const count = accepted.size, [job] = await jobs(p.id); check(job.status === "sending", "FINISH_LOSS");
      await admin.from("natori_notification_jobs").update({ lease_expires_at: past(), retry_after: past() }).eq("id", job.id);
      const replay = await issue(op); check(replay.kind === "ok" && replay.notificationStatus === "sent" && accepted.size === count, "FINISH_DUPLICATE");
    });
    await test("accept-race-and-resend-preserve-old-link-and-confirmed-facts", async () => {
      const p = await project(), f = await upload(p.id); await issue(input(p.id, [f.fileId])); const t = await token(p.id), first = await row(p.id);
      const [a, b, sent] = await Promise.all([files.acceptNatoriDelivery(t), files.acceptNatoriDelivery(t), issue(input(p.id, [f.fileId]))]);
      check([a.kind, b.kind].sort().join() === ["already-accepted", "ok"].sort().join() && sent.kind === "ok", "ACCEPT_RACE");
      const done = await row(p.id); check(done.status === "completed" && done.delivery_accepted_at && done.delivery_token_hash === first.delivery_token_hash
        && done.delivery_token_expires_at === first.delivery_token_expires_at, "RESEND_RESET");
      const replay = await files.acceptNatoriDelivery(t); check(replay.kind === "already-accepted" && replay.acceptedAt === done.delivery_accepted_at, "ACCEPT_REPLAY");
      check((await jobs(p.id)).filter(j => j.purpose.startsWith("delivery_accept_")).length === 2, "ACCEPT_NOTICE_DUPLICATE");
      check((await files.getNatoriDeliveryByToken(t)).kind === "ok", "OLD_URL_LOST");
    });
    await test("acceptance-commit-loss-reconciles-and-precommit-failure-does-not", async () => {
      const p = await project(), f = await upload(p.id); await issue(input(p.id, [f.fileId])); const t = await token(p.id);
      rejectAccept = true; check((await files.acceptNatoriDelivery(t)).kind === "db-error" && (await row(p.id)).delivery_accepted_at === null, "FALSE_ACCEPT_SUCCESS");
      loseAccept = true; check((await files.acceptNatoriDelivery(t)).kind === "already-accepted" && (await row(p.id)).status === "completed", "ACCEPT_COMMIT_LOSS");
    });
    await test("accepted-revisit-does-not-reverse-completion-after-external-file-loss", async () => {
      const p = await project(), f = await upload(p.id); await issue(input(p.id, [f.fileId])); const t = await token(p.id); await files.acceptNatoriDelivery(t);
      const before = await row(p.id); await admin.storage.from("natori-deliveries").remove([f.path]);
      const view = await files.getNatoriDeliveryByToken(t); check(view.kind === "ok" && view.delivery.acceptedAt && !view.delivery.files[0].available, "ACCEPTED_REVISIT");
      check((await files.acceptNatoriDelivery(t)).kind === "already-accepted" && JSON.stringify(before) === JSON.stringify(await row(p.id)), "COMPLETION_REVERSED");
    });
    await test("legacy-link-import-retains-hash-expiry-and-prior-completion", async () => {
      const t = randomBytes(24).toString("base64url"), date = past(), expiry = new Date(Date.now() + 86400000).toISOString();
      const p = await project("Legacy accepted", { status: "completed", delivery_token_hash: hash(t), delivery_token_expires_at: expiry, delivery_accepted_at: date, completed_at: date, delivered_mail_at: date });
      const id = randomUUID(), path = `${p.id}/final/${id}.bin`, bytes = Buffer.from("legacy synthetic bytes");
      check(!(await admin.from("natori_delivery_files").insert({ id, project_id: p.id, folder: "final", storage_path: path, file_name: "legacy.bin", size_bytes: bytes.length })).error, "LEGACY_ROW");
      check(!(await admin.storage.from("natori-deliveries").upload(path, bytes)).error, "LEGACY_STORAGE");
      check(await manage(() => ready.finalizeDeliveryFile(id)) === "ready", "LEGACY_VERIFICATION");
      const before = await row(p.id); check((await issue(input(p.id, [id]))).kind === "ok", "LEGACY_IMPORT");
      const after = await row(p.id);
      check(JSON.stringify({ ...before, mutation_revision: after.mutation_revision }) === JSON.stringify(after), "LEGACY_FACTS_CHANGED");
      check(Number.isSafeInteger(before.mutation_revision) && after.mutation_revision === before.mutation_revision + 1, "LEGACY_REVISION_FENCE");
      const view = await files.getNatoriDeliveryByToken(t); check(view.kind === "ok" && view.delivery.acceptedAt === before.delivery_accepted_at, "LEGACY_URL_LOST");
    });
    await test("foreign-owner-and-closed-unpaid-guards-preserve-rows", async () => {
      for (const patch of [{ user_id: stranger.data.user.id }, { status: "closed" }, { payment_confirmed_at: null }]) {
        const p = await project("Guard fixture", patch), before = await row(p.id);
        const result = await manage(() => files.signNatoriDeliveryUpload({ projectId: p.id, folder: "final", fileName: "guard.bin", sizeBytes: 23 }));
        if (patch.payment_confirmed_at === null) {
          check(result.kind === "ok", "UNPAID_RESERVE");
          const directIssue = await admin.rpc("natori_delivery_issue_v1", { p_owner_id: owner, p_project_id: p.id, p_operation_id: randomUUID(), p_to_email: "client@phase-1.invalid",
            p_request_hash: hash("test"), p_manifest: [], p_verified_at: new Date().toISOString(), p_token_hash: hash("synthetic"), p_expires_at: new Date(Date.now() + 60000).toISOString(), p_payload: {} });
          check(directIssue.data?.[0]?.result === "invalid-state", "UNPAID_PUBLISH");
        } else check(result.kind !== "ok", "FOREIGN_CLOSED_RESERVE");
        check(JSON.stringify(before) === JSON.stringify(await row(p.id)), "GUARD_MUTATED_PROJECT");
      }
    });
    await test("encrypted-payload-expiry-erases-ciphertext-only", async () => {
      const p = await project(); const id = randomUUID();
      const expired = { format: "natori-delivery-aes256gcm-v1", expiresAt: past(), ciphertext: "synthetic_ciphertext", iv: "synthetic_iv", tag: "synthetic_tag" };
      const r = await admin.from("natori_notification_jobs").insert({ id, notification_key: `expired/${id}`, project_id: p.id, purpose: "delivery_issue_client", snapshot: { unchanged: true }, payload: expired, status: "sent", provider_id: "synthetic", sent_at: past() });
      check(!r.error, "EXPIRY_FIXTURE"); const before = (await jobs(p.id))[0];
      check((await admin.rpc("natori_delivery_purge_payloads_v1", { p_owner_id: owner })).data! >= 1, "PURGE");
      const after = (await jobs(p.id))[0]; check((after.payload as { ciphertext: string }).ciphertext === "" && after.sent_at === before.sent_at
        && JSON.stringify(after.snapshot) === JSON.stringify(before.snapshot), "PURGE_DESTROYED_EVIDENCE");
    });
    await test("real-50mb-signed-tus-upload-range-read-and-size-boundary", async () => {
      const p = await project(), size = DELIVERY_MAX_BYTES, f = await reserve(p.id, size);
      const chunk = Buffer.alloc(6 * 1024 * 1024, 0x5a);
      async function* stream() { for (let sent = 0; sent < size; sent += chunk.length) yield chunk.subarray(0, Math.min(chunk.length, size - sent)); }
      await new Promise<void>((resolve, reject) => new Upload(Readable.from(stream()), { endpoint: `${origin}/storage/v1/upload/resumable/sign`,
        headers: { "x-signature": f.token }, uploadSize: size, chunkSize: chunk.length, retryDelays: [], uploadDataDuringCreation: true,
        metadata: { bucketName: "natori-deliveries", objectName: f.path, contentType: "application/octet-stream" },
        onBeforeRequest: req => { check(new URL(req.getURL()).origin === origin, "TUS_DESTINATION_REJECTED"); },
        onAfterResponse: (_req, res) => {
          const location = res.getHeader("Location"); if (!location) return;
          const target = new URL(location, origin), base = new URL(origin);
          tusDiagnostics.push({ status: res.getStatus(), originAllowed: target.origin === origin, protocol: target.protocol, hostMatches: target.host === base.host });
        },
        onError: error => {
          const status = "originalResponse" in error ? error.originalResponse?.getStatus() : undefined;
          reject(new Error(status ? `TUS_HTTP_${status}` : error.message.includes("TUS_DESTINATION_REJECTED") ? "TUS_DESTINATION_REJECTED" : "TUS_UPLOAD_FAILED"));
        }, onSuccess: () => resolve(), }).start());
      check(await manage(() => ready.finalizeDeliveryFile(f.fileId)) === "ready", "LARGE_FINALIZE");
      const signed = await admin.storage.from("natori-deliveries").createSignedUrl(f.path, 60); check(signed.data, "LARGE_READ_SIGN");
      const response = await fetch(signed.data.signedUrl); check(response.ok && response.body, "LARGE_READ");
      let length = 0; const digest = createHash("sha256");
      for await (const data of response.body as unknown as AsyncIterable<Uint8Array>) { length += data.length; digest.update(data); }
      const expected = createHash("sha256"); for await (const data of stream()) expected.update(data);
      check(length === size && digest.digest("hex") === expected.digest("hex"), "LARGE_BYTES");
      check((await manage(() => files.signNatoriDeliveryUpload({ projectId: p.id, folder: "final", fileName: "oversize.bin", sizeBytes: size + 1 }))).kind === "too-large", "SIZE_BOUNDARY");
      const oversizeId = randomUUID();
      const directOversize = await admin.rpc("natori_delivery_reserve_v1", { p_owner_id: owner, p_project_id: p.id,
        p_file_id: oversizeId, p_folder: "final", p_path: `${p.id}/final/${oversizeId}.bin`, p_file_name: "oversize.bin",
        p_size_bytes: size + 1, p_content_type: "application/octet-stream" });
      check(directOversize.data?.[0]?.result === "invalid-input", "DB_SIZE_BOUNDARY");
    });
    writeFileSync("/results/phase1-integration.json", JSON.stringify({ tests: results, passed: results.filter(r => r.status === "passed").length,
      failed: results.filter(r => r.status === "failed").length, skipped: 0, providerRequests: calls, distinctAcceptedMessages: accepted.size,
      storage: "Real isolated DB/Auth/Storage; includes 50MB (50,000,000 bytes) signed TUS and complete bytes digest", tusDiagnostics }, null, 2));
    console.log(`TUS routing classifications: ${JSON.stringify(tusDiagnostics)}`);
    check(results.length === 28 && results.every(r => r.status === "passed"), "REQUIRED_TESTS_FAILED");
    console.log(`PHASE 1 ${results.length} passed / 0 failed / 0 skipped`);
  } finally { globalThis.fetch = direct; await new Promise<void>(resolve => capture.close(() => resolve())); }
}
main().catch(() => { console.error(`Phase 1 failed at ${stage}; raw credentials, URLs and bodies withheld`); process.exitCode = 1; });
