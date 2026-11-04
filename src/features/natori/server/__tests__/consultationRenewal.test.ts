import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), fetch: vi.fn(), writes: [] as string[] }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from, rpc: m.rpc }) }));
vi.mock("@/features/natori/server/caseAcceptance", () => ({ acceptanceProjectAllowed: async () => true }));
import { renewClientConsultationLink } from "@/features/natori/server/consultationService";

const owner = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const projectId = "11111111-2222-4333-8444-555555555555";
const token = "A".repeat(43);
let admitted = true;

/** Chainable query stub: maybeSingle() and direct await both resolve to { data, error: null }. */
function query(data: unknown, onWrite?: () => void) {
  const value: unknown = new Proxy({}, {
    get(_target, key) {
      if (key === "maybeSingle") return async () => ({ data, error: null });
      if (key === "then") return (resolve: (v: unknown) => void) => resolve({ data, error: null });
      if ((key === "update" || key === "insert") && onWrite) return () => { onWrite(); return value; };
      return () => value;
    },
  });
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.writes.length = 0;
  admitted = true;
  // Production shape: the case workspace release is on and the bootstrap phase is managed.
  vi.stubEnv("NATORI_CASE_RELEASE_ENABLED", "1");
  vi.stubEnv("NATORI_CASE_BOOTSTRAP_PHASE", "managed");
  vi.stubEnv("NATORI_OWNER_USER_ID", owner);
  vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "1");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET", "");
  vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET", "");
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_NO_MAIL", "");
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_CONNECTION", "");
  vi.stubEnv("NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS", "");
  m.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "email_1" }) });
  vi.stubGlobal("fetch", m.fetch);
  m.rpc.mockImplementation(async (name: string) => name === "natori_case_system_status_v1"
    ? { data: { owner, generation: 1, armed: true, commandsHeld: false, sendersHeld: false, readOnly: false }, error: null }
    : { data: name === "natori_case_system_admit_v1" ? admitted : null, error: null });
  m.from.mockImplementation((table: string) => table === "natori_projects"
    ? query({ id: projectId, user_id: owner, title: "t", client_name: "依頼者", client_email: "client@example.com", note: null, request_data: null, status: "inquiry", deleted_at: null })
    : query({ id: "link-1", project_id: projectId, created_at: new Date().toISOString(), renewed_at: null }, () => m.writes.push(table)));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("consultation link renewal with the case release on", () => {
  it("sends the new link through the current sender gate", async () => {
    expect(await renewClientConsultationLink(token)).toBe("ok");
    expect(m.rpc.mock.calls.filter(([name, args]) => name === "natori_case_system_admit_v1" && args.p_kind === "sender").length).toBeGreaterThan(0);
    expect(m.rpc.mock.calls.some(([, args]) => args?.p_kind === "legacy-sender")).toBe(false);
    expect(m.writes).toEqual(["natori_consultation_access", "natori_consultation_access"]);
    expect(m.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = m.fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["client@example.com"]);
    expect(body.text).toMatch(/\/natori\/consult\/[A-Za-z0-9_-]{43}/);
    expect(init.headers["Idempotency-Key"]).toMatch(/^natori-consult-renew\/link-1\//);
  });

  it("writes nothing when the sender gate is closed", async () => {
    admitted = false;
    expect(await renewClientConsultationLink(token)).toBe("mail-error");
    expect(m.writes).toEqual([]);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("writes nothing when sending is switched off", async () => {
    vi.stubEnv("NATORI_NOTIFICATION_SENDING_ENABLED", "0");
    expect(await renewClientConsultationLink(token)).toBe("mail-error");
    expect(m.writes).toEqual([]);
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
