import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), verify: vi.fn(), seal: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/features/natori/server/natoriOwner", () => ({ resolveNatoriOwnerId: vi.fn(async () => "owner-1") }));
vi.mock("@/features/natori/server/deliveryStorageVerification", () => ({ verifyDeliveryObject: mocks.verify }));
vi.mock("@/features/natori/server/deliveryNotificationPayload", () => ({ sealDeliveryNotification: mocks.seal }));
vi.mock("@/features/natori/server/acceptanceNotifications", () => ({
  acceptanceOutboxEnabled: () => true, notificationSendingEnabled: () => false, dispatchAcceptanceNotification: vi.fn(),
}));
vi.mock("@/lib/constants", () => ({ getSiteUrl: () => "https://example.com" }));

import { issueReadyDelivery } from "../deliveryReleaseService";

const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const operationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const releaseId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const noticeId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const manifest = [{ id: fileId, path: `${projectId}/final/${fileId}.png`, fileName: "synthetic.png",
  sizeBytes: 10, contentType: "image/png", storageVersion: "synthetic-version" }];
const input = { projectId, operationId, fileIds: [fileId], to: "synthetic@example.com", subject: "Synthetic",
  body: "Download: {納品ページリンク}", extension: { days: 14, reason: "Client asked for a resend" } };
type Result = { data: unknown; error: unknown };

function query(result: Result) {
  const chain: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === "then") return (resolve: (result: Result) => void) => resolve(result);
      if (prop === "maybeSingle") return () => Promise.resolve(result);
      return () => chain;
    },
  });
  return chain;
}

function installDb(opts: { release?: Record<string, unknown> | null; operation?: Record<string, unknown> | null; rpcResult?: string } = {}) {
  const release = opts.release === undefined ? { id: releaseId, project_id: projectId, manifest } : opts.release;
  mocks.from.mockImplementation((table: string) => {
    const rows: Record<string, unknown> = {
      natori_delivery_releases: release, natori_delivery_operations: opts.operation ?? null,
      natori_notification_jobs: { status: "queued" },
    };
    if (!(table in rows)) throw new Error(`Unexpected table ${table}`);
    return { select: () => query({ data: rows[table], error: null }) };
  });
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "natori_delivery_purge_payloads_v1") return { data: null, error: null };
    if (name === "natori_delivery_extend_v1") {
      const result = opts.rpcResult ?? "extended";
      return { data: [{ result, release_id: result === "extended" ? releaseId : null, notification_id: result === "extended" ? noticeId : null }], error: null };
    }
    throw new Error(`Unexpected rpc ${name}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NATORI_ORDER_MAIL_FROM", "from@example.com");
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "reply@example.com");
  mocks.verify.mockResolvedValue({ url: "https://signed.example/file" });
  mocks.seal.mockImplementation((payload: unknown) => ({ format: "natori-delivery-aes256gcm-v1", payload }));
});

describe("issueReadyDelivery with an extension", () => {
  it("リリースの控えにあるファイルだけを、延長した期限で新しいリンクにして再送する", async () => {
    installDb();
    const result = await issueReadyDelivery(input);
    expect(result).toMatchObject({ kind: "ok", releaseId });
    const call = mocks.rpc.mock.calls.find(([name]) => name === "natori_delivery_extend_v1")!;
    const args = call[1] as Record<string, unknown>;
    expect(args).toMatchObject({ p_owner_id: "owner-1", p_project_id: projectId, p_operation_id: operationId, p_reason: "Client asked for a resend", p_manifest: manifest });
    const days = (Date.parse(String(args.p_new_expires_at)) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(13.99);
    expect(days).toBeLessThan(14.01);
    const text = (mocks.seal.mock.calls.at(-1)![0] as { text: string }).text;
    const token = text.match(/https:\/\/example\.com\/natori\/delivery\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(args.p_token_hash).toBe(createHash("sha256").update(token!).digest("hex"));
    expect(text).toContain("以前のリンクは使えません");
  });

  it("選べない日数や、理由が空の延長は受け付けない", async () => {
    installDb();
    expect(await issueReadyDelivery({ ...input, extension: { days: 3, reason: "x" } })).toEqual({ kind: "invalid-state" });
    expect(await issueReadyDelivery({ ...input, extension: { days: 7, reason: "   " } })).toEqual({ kind: "invalid-state" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("natori_delivery_extend_v1", expect.anything());
  });

  it("発行済みと違うファイルの組は再送しない", async () => {
    installDb();
    const other = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    expect(await issueReadyDelivery({ ...input, fileIds: [other] })).toEqual({ kind: "no-files" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("natori_delivery_extend_v1", expect.anything());
  });

  it("Storage で確認できないファイルがあれば再送しない", async () => {
    installDb();
    mocks.verify.mockResolvedValue(null);
    expect(await issueReadyDelivery(input)).toEqual({ kind: "no-files" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("natori_delivery_extend_v1", expect.anything());
  });

  it("納品が発行されていない案件は延長できない", async () => {
    installDb({ release: null });
    expect(await issueReadyDelivery(input)).toEqual({ kind: "invalid-state" });
  });

  it.each([
    ["invalid-expiry", "invalid-expiry"], ["notice-pending", "notice-pending"], ["conflict", "delivery-conflict"],
    ["unavailable", "no-files"], ["not-found", "not-found"], ["invalid-state", "invalid-state"],
  ])("DB が %s を返したら %s にする", async (rpcResult, kind) => {
    installDb({ rpcResult });
    expect(await issueReadyDelivery(input)).toEqual({ kind });
  });

  it("同じ操作の再実行は、前回の結果をそのまま返し、DB に書かない", async () => {
    installDb();
    await issueReadyDelivery(input);
    const hashed = (mocks.rpc.mock.calls.find(([name]) => name === "natori_delivery_extend_v1")![1] as Record<string, unknown>).p_request_hash;
    vi.clearAllMocks();
    installDb({ operation: { request_hash: hashed, release_id: releaseId, notification_id: noticeId } });
    mocks.verify.mockResolvedValue({ url: "x" });
    expect(await issueReadyDelivery(input)).toMatchObject({ kind: "ok", releaseId });
    expect(mocks.rpc).not.toHaveBeenCalledWith("natori_delivery_extend_v1", expect.anything());
  });

  it("同じ操作で内容が違えば競合として扱う", async () => {
    installDb({ operation: { request_hash: "0".repeat(64), release_id: releaseId, notification_id: noticeId } });
    expect(await issueReadyDelivery(input)).toEqual({ kind: "delivery-conflict" });
  });
});
