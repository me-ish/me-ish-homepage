import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), legacy: vi.fn(), network: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/features/natori/server/natoriOwner", () => ({ resolveNatoriOwnerId: async () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }));
vi.mock("@/features/natori/server/deliveryFilesService", () => ({ deliveryIntegrityEnabled: () => false }));
vi.mock("@/features/natori/server/consultationOperationService", () => ({ queueLegacyConsultationNotice: mocks.legacy }));
// Keep notificationManagement and acceptanceNotifications real: a mocked retry
// would hide the sending kill switch that the disposable DB fixture must honor.
import { retryStaffConsultationNotification } from "@/features/natori/server/consultationService";

const projectId = "11111111-2222-4333-8444-555555555555";
const messageId = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const notificationId = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
let projectFound = true;
function query(data: unknown) {
  const value: unknown = new Proxy({}, {
    get(_target, key) {
      if (key === "maybeSingle") return async () => ({ data, error: null });
      return () => value;
    },
  });
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  projectFound = true;
  vi.stubEnv("NATORI_ACCEPTANCE_OUTBOX_ENABLED", "1");
  vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "0");
  mocks.network.mockImplementation(() => { throw new Error("NETWORK_FORBIDDEN"); });
  vi.stubGlobal("fetch", mocks.network);
  mocks.from.mockImplementation((table: string) => query(table === "natori_projects"
    ? projectFound ? { id: projectId, user_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", status: "inquiry", deleted_at: null } : null
    : { id: messageId, notification_id: notificationId }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("manual consultation notification retry honors the actual kill switches", () => {
  it.each(["1", "0"])("refuses sending-off with outbox=%s without queuing or dispatching", async outbox => {
    vi.stubEnv("NATORI_ACCEPTANCE_OUTBOX_ENABLED", outbox);
    expect(await retryStaffConsultationNotification(projectId, messageId)).toBe("notification-failed");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.network).not.toHaveBeenCalled();
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["natori_projects", "natori_consultation_messages"]);
  });
  it("rejects an unavailable owner-scoped project before retry side effects", async () => {
    projectFound = false;
    expect(await retryStaffConsultationNotification(projectId, messageId)).toBe("not-found");
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["natori_projects"]);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.network).not.toHaveBeenCalled();
  });
});
