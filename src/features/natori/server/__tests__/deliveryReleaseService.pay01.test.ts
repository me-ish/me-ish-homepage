import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

import { acceptReadyDelivery, issueReadyDelivery } from "../deliveryReleaseService";
import { canManuallyTransitionNatoriStatus } from "../../lib/statusTransitions";

const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const operationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const releaseId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const manifest = [{ id: fileId, path: `${projectId}/final/${fileId}.png`, fileName: "synthetic.png",
  sizeBytes: 10, contentType: "image/png", storageVersion: "synthetic-version" }];
const input = { projectId, operationId, fileIds: [fileId], to: "synthetic@example.com", subject: "Synthetic", body: "Synthetic" };
type Result = { data: unknown; error: unknown };

function issuedToken(): string {
  const notification = mocks.seal.mock.calls.at(-1)?.[0] as { text?: string } | undefined;
  const token = notification?.text?.match(/https:\/\/example\.com\/natori\/delivery\/([A-Za-z0-9_-]+)/)?.[1];
  if (!token) throw new Error("The issued notification has no requester link");
  return token;
}

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

// This fake supplies RPC results; the native SQL integration suite checks the
// corresponding atomic writes. No mail transport or Storage call is performed.
function installDb() {
  const project = { id: projectId, user_id: "owner-1", title: "Synthetic", client_name: "Synthetic client",
    status: "delivery_prep", payment_confirmed_at: "2026-10-01T12:00:00Z", deleted_at: null,
    delivery_accepted_at: null as string | null, completed_at: null as string | null,
    delivery_token_hash: null as string | null, delivery_token_expires_at: "2099-01-01T00:00:00Z" };
  let release: Record<string, unknown> | null = null;
  let access: Record<string, unknown> | null = null;
  const writes = vi.fn();
  mocks.from.mockImplementation((table: string) => {
    const rows: Record<string, unknown> = {
      natori_projects: project, natori_delivery_releases: release, natori_delivery_access: access,
      natori_delivery_operations: null, natori_notification_jobs: { status: "queued" },
      natori_delivery_files: [{ id: fileId, project_id: projectId, state: "ready", folder: "final",
        storage_path: manifest[0].path, file_name: manifest[0].fileName, size_bytes: 10,
        content_type: "image/png", storage_version: "synthetic-version" }],
    };
    if (!(table in rows)) throw new Error(`Unexpected table ${table}`);
    return { select: () => query({ data: rows[table], error: null }), update: writes, insert: writes };
  });
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "natori_delivery_purge_payloads_v1") return { data: null, error: null };
    if (name === "natori_delivery_issue_v1") {
      project.status = "delivered";
      project.delivery_token_hash = String(args.p_token_hash);
      release = { id: releaseId, project_id: projectId, manifest, accepted_at: null };
      access = { release_id: releaseId, expires_at: "2099-01-01T00:00:00Z" };
      return { data: [{ result: "issued", release_id: releaseId, notification_id: "notice-1" }], error: null };
    }
    if (name === "natori_accept_delivery_ready_v1") {
      const stamp = "2026-10-02T12:00:00Z";
      const already = Boolean(project.delivery_accepted_at);
      project.status = "completed";
      project.delivery_accepted_at = stamp;
      project.completed_at = stamp;
      return { data: [{ result: already ? "already-accepted" : "accepted", accepted_at: stamp,
        notification_ids: already ? [] : ["notice-2"] }], error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  return { project, writes };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NATORI_ORDER_MAIL_FROM", "synthetic@example.com");
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "synthetic-artist@example.com");
  mocks.verify.mockResolvedValue({ url: "https://example.com/synthetic" });
  mocks.seal.mockReturnValue({ synthetic: "sealed-notification" });
});
afterEach(() => vi.unstubAllEnvs());

describe("dedicated delivery issuance and requester acceptance compatibility (PAY-01)", () => {
  it("publishes through the issue RPC, then completes only through requester acceptance", async () => {
    const db = installDb();
    expect(canManuallyTransitionNatoriStatus("delivery_prep", "delivered")).toBe(false);
    expect(await issueReadyDelivery(input)).toEqual({ kind: "ok", releaseId, notificationStatus: "queued" });
    expect(db.project.status).toBe("delivered");
    expect(db.project.completed_at).toBeNull();
    expect(db.project.delivery_accepted_at).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("natori_delivery_issue_v1", expect.objectContaining({
      p_owner_id: "owner-1", p_project_id: projectId, p_operation_id: operationId, p_manifest: manifest,
    }));

    const token = issuedToken();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    expect(db.project.delivery_token_hash).toBe(tokenHash);
    expect(canManuallyTransitionNatoriStatus("delivered", "completed")).toBe(false);
    expect(await acceptReadyDelivery(token)).toEqual({ kind: "ok", notificationIds: ["notice-2"], acceptedAt: "2026-10-02T12:00:00Z" });
    expect(mocks.rpc).toHaveBeenCalledWith("natori_accept_delivery_ready_v1", expect.objectContaining({
      p_token_hash: tokenHash, p_release_id: releaseId, p_manifest: manifest,
    }));
    expect(db.project.status).toBe("completed");
    expect(db.project.completed_at).toBe(db.project.delivery_accepted_at);
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("replays accepted delivery without undoing completion when files later disappear", async () => {
    const db = installDb();
    await issueReadyDelivery(input);
    const token = issuedToken();
    await acceptReadyDelivery(token);
    mocks.verify.mockClear().mockResolvedValue(null);
    const before = { ...db.project };
    expect(await acceptReadyDelivery(token)).toMatchObject({ kind: "already-accepted", acceptedAt: before.delivery_accepted_at });
    expect(db.project).toEqual(before);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("does not publish when a final file is unavailable", async () => {
    const db = installDb();
    mocks.verify.mockResolvedValue(null);
    expect(await issueReadyDelivery(input)).toEqual({ kind: "no-files" });
    expect(db.project.status).toBe("delivery_prep");
    expect(mocks.rpc).not.toHaveBeenCalledWith("natori_delivery_issue_v1", expect.anything());
  });

  it("does not claim a successful issue when the issue RPC fails without committed evidence", async () => {
    const db = installDb();
    mocks.rpc.mockImplementation(async (name: string) => name === "natori_delivery_issue_v1"
      ? { data: null, error: { code: "synthetic-unavailable" } } : { data: null, error: null });
    expect(await issueReadyDelivery(input)).toEqual({ kind: "db-error" });
    expect(db.project.status).toBe("delivery_prep");
    expect(db.project.completed_at).toBeNull();
  });

  it("does not accept a published delivery whose file is unavailable", async () => {
    const db = installDb();
    await issueReadyDelivery(input);
    const token = issuedToken();
    mocks.rpc.mockClear();
    mocks.verify.mockResolvedValue(null);
    expect(await acceptReadyDelivery(token)).toEqual({ kind: "files-unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(db.project.status).toBe("delivered");
    expect(db.project.completed_at).toBeNull();
  });

  it("does not claim acceptance when RPC transport fails and reread has no acceptance", async () => {
    const db = installDb();
    await issueReadyDelivery(input);
    const token = issuedToken();
    mocks.rpc.mockRejectedValue(new Error("synthetic-unavailable"));
    expect(await acceptReadyDelivery(token)).toEqual({ kind: "db-error" });
    expect(db.project.status).toBe("delivered");
    expect(db.project.delivery_accepted_at).toBeNull();
    expect(db.project.completed_at).toBeNull();
  });
});
