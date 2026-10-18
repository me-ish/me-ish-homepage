import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), verify: vi.fn(), seal: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: async () => "owner-1" }));
vi.mock("../deliveryStorageVerification", () => ({ verifyDeliveryObject: mocks.verify }));
vi.mock("../deliveryNotificationPayload", () => ({ sealDeliveryNotification: mocks.seal }));
vi.mock("../acceptanceNotifications", () => ({
  acceptanceOutboxEnabled: () => true, notificationSendingEnabled: () => true, dispatchAcceptanceNotification: mocks.dispatch,
}));
vi.mock("@/lib/constants", () => ({ getSiteUrl: () => "https://example.invalid" }));

import { acceptReadyDelivery, getReadyDelivery, issueReadyDelivery } from "../deliveryReleaseService";

const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const releaseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const fileId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const operationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const noticeId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const originalExpiry = "2026-10-10T00:00:00Z";
const extensionExpiry = "2026-10-24T00:00:00Z";
const manifest = [{ id: fileId, path: `${projectId}/final/${fileId}.png`, fileName: "synthetic.png",
  sizeBytes: 10, contentType: "image/png", storageVersion: "synthetic-version" }];
const input = { projectId, operationId, fileIds: [fileId], to: "client@example.invalid", subject: "Synthetic", body: "Synthetic" };
const requestHash = () => createHash("sha256").update(JSON.stringify({ project: projectId, files: [fileId],
  to: input.to, subject: input.subject, body: input.body })).digest("hex");
type Result = { data: unknown; error: unknown };
type Options = { original?: string; extension?: string | null; extensionError?: boolean; extensionReject?: boolean;
  operation?: Record<string, unknown>; rpcResult?: string; responseLost?: boolean };

function install(options: Options = {}) {
  const project = { id: projectId, user_id: "owner-1", status: "delivered", payment_confirmed_at: "2026-10-01T00:00:00Z",
    delivery_accepted_at: null as string | null, deleted_at: null, delivery_token_hash: "old-hash",
    delivery_token_expires_at: originalExpiry };
  const release = { id: releaseId, project_id: projectId, manifest, snapshot: {}, expires_at: options.original ?? originalExpiry };
  const extension = options.extension === null ? null : { new_expires_at: options.extension ?? extensionExpiry };
  let operation: Record<string, unknown> | null = options.operation ?? null;
  let access: Record<string, unknown> | null = null;
  const filters: Array<[string, string, unknown]> = [];
  mocks.from.mockImplementation((table: string) => ({ select: () => {
    const values: Record<string, unknown> = { natori_projects: project, natori_delivery_releases: release,
      natori_delivery_extensions: extension, natori_delivery_operations: operation, natori_delivery_access: access,
      natori_notification_jobs: { status: "sent" }, natori_delivery_files: [{ id: fileId, state: "ready",
        storage_path: manifest[0].path, file_name: "synthetic.png", size_bytes: 10, content_type: "image/png", storage_version: "synthetic-version" }] };
    if (!(table in values)) throw new Error(`Unexpected table ${table}`);
    const result: Result = { data: values[table], error: table === "natori_delivery_extensions" && options.extensionError ? { code: "synthetic" } : null };
    const chain: unknown = new Proxy({}, { get(_, method) {
      if (method === "then") return (resolve: (value: Result) => void) => resolve(result);
      if (method === "maybeSingle") return () => table === "natori_delivery_extensions" && options.extensionReject
        ? Promise.reject(new Error("synthetic transport")) : Promise.resolve(result);
      return (...args: unknown[]) => { if (method === "eq") filters.push([table, String(args[0]), args[1]]); return chain; };
    } });
    return chain;
  } }));
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "natori_delivery_purge_payloads_v1") return { data: null, error: null };
    if (name === "natori_delivery_issue_v1") {
      const result = options.rpcResult ?? "issued";
      if (result === "issued") {
        access = { release_id: releaseId, expires_at: args.p_expires_at };
        operation = { request_hash: args.p_request_hash, release_id: releaseId, notification_id: noticeId };
      }
      if (options.responseLost) return { data: null, error: { code: "transport" } };
      return { data: [{ result, release_id: result === "issued" ? releaseId : null,
        notification_id: result === "issued" ? noticeId : null }], error: null };
    }
    if (name === "natori_accept_delivery_ready_v1") {
      project.delivery_accepted_at = "2026-10-17T00:00:00Z";
      project.status = "completed";
      return { data: [{ result: "accepted", accepted_at: project.delivery_accepted_at, notification_ids: [] }], error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  return { project, release, filters };
}

const issuedCalls = () => mocks.rpc.mock.calls.filter(([name]) => name === "natori_delivery_issue_v1");
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T00:00:00Z"));
  vi.stubEnv("NATORI_ORDER_MAIL_FROM", "staff@example.invalid");
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "reply@example.invalid");
  mocks.verify.mockResolvedValue({ url: "https://example.invalid/synthetic" });
  mocks.seal.mockReturnValue({ format: "natori-delivery-aes256gcm-v1", ciphertext: "synthetic" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("ordinary delivery resend after extension (Q01)", () => {
  it("resends at the extended expiry and keeps the original release intact through read/accept", async () => {
    const db = install();
    const original = structuredClone(db.release);
    expect(await issueReadyDelivery(input)).toMatchObject({ kind: "ok", releaseId });
    const args = issuedCalls()[0][1] as Record<string, unknown>;
    expect(args).toMatchObject({ p_expires_at: extensionExpiry, p_manifest: manifest, p_request_hash: requestHash() });
    expect(db.filters).toContainEqual(["natori_delivery_extensions", "release_id", releaseId]);
    const mail = mocks.seal.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain("2026/10/24");
    expect(mail.text).toContain("再送でも延長されません");
    const token = mail.text.match(/\/natori\/delivery\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(await getReadyDelivery(token!)).toMatchObject({ kind: "ok", delivery: { expiresAt: extensionExpiry, canAccept: true } });
    expect(await acceptReadyDelivery(token!)).toMatchObject({ kind: "ok" });
    expect(db.release).toEqual(original);
  });

  it("retains the original unexpired deadline when no extension exists", async () => {
    install({ original: extensionExpiry, extension: null });
    expect(await issueReadyDelivery(input)).toMatchObject({ kind: "ok" });
    expect(issuedCalls()[0][1]).toMatchObject({ p_expires_at: extensionExpiry });
  });

  it.each([null, "2026-10-16T00:00:00Z"])("does not resend after the effective deadline (%s)", async extension => {
    install({ extension });
    expect(await issueReadyDelivery(input)).toEqual({ kind: "delivery-expired" });
    expect(issuedCalls()).toHaveLength(0);
    expect(mocks.seal).not.toHaveBeenCalled();
  });

  it.each([{ extensionError: true }, { extensionReject: true }, { extension: "invalid" }])("fails closed when the extension cannot be read: %j", async options => {
    install(options);
    expect(await issueReadyDelivery(input)).toEqual({ kind: "db-error" });
    expect(issuedCalls()).toHaveLength(0);
    expect(mocks.seal).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("surfaces a concurrent expiry change without retrying or dispatching", async () => {
    install({ rpcResult: "expiry-changed" });
    expect(await issueReadyDelivery(input)).toEqual({ kind: "delivery-expiry-changed" });
    expect(issuedCalls()).toHaveLength(1);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("reconciles a committed issue after response loss with its original notice", async () => {
    install({ responseLost: true });
    expect(await issueReadyDelivery(input)).toMatchObject({ kind: "ok", releaseId });
    expect(issuedCalls()).toHaveLength(1);
    expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(noticeId);
  });

  it("replays the same operation before reading expiry or generating a replacement payload", async () => {
    install({ operation: { request_hash: requestHash(), release_id: releaseId, notification_id: noticeId }, extensionReject: true });
    expect(await issueReadyDelivery(input)).toMatchObject({ kind: "ok", releaseId });
    expect(mocks.from).not.toHaveBeenCalledWith("natori_delivery_extensions");
    expect(issuedCalls()).toHaveLength(0);
    expect(mocks.seal).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(noticeId);
  });

  it("keeps a changed request on an existing operation in conflict", async () => {
    install({ operation: { request_hash: "0".repeat(64), release_id: releaseId, notification_id: noticeId } });
    expect(await issueReadyDelivery(input)).toEqual({ kind: "delivery-conflict" });
    expect(issuedCalls()).toHaveLength(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
