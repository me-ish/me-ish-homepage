import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), signed: vi.fn(), roughOks: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from, storage: { from: () => ({ createSignedUrl: m.signed }) } }) }));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: async () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }));
vi.mock("../roughFollowupService", () => ({ loadStaffRoughOks: m.roughOks }));
const sig = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../talkSignatureService", () => ({ readTalkSignature: sig.read }));
import { getClientConsultationProbe, getStaffConsultationProbe } from "../consultationService";

const pid = "11111111-2222-4333-8444-555555555555";
const owner = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
let project: Record<string, unknown> | null;
let probeResult: { data: { id: string }[] | null; count: number | null; error: unknown };
let roughResult: { data: { id: string; client_ok_at: string | null }[] | null; error: unknown };

function chain(result: unknown) {
  const query: unknown = new Proxy({}, { get(_target, key) {
    if (key === "then") return (resolve: (value: unknown) => void) => resolve(result);
    if (key === "maybeSingle") return async () => result;
    return () => query;
  } });
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.roughOks.mockResolvedValue([]);
  sig.read.mockResolvedValue("sig1");
  project = { id: pid, user_id: owner, title: "T", client_name: "C", client_email: null, note: null, request_data: null, status: "open", deleted_at: null };
  probeResult = { data: [{ id: "last" }], count: 3, error: null };
  roughResult = { data: [], error: null };
  m.from.mockImplementation((table: string) => {
    if (table === "natori_talk_roughs") return chain(roughResult);
    if (table === "natori_projects") return chain({ data: project, error: null });
    if (table === "natori_consultation_access") return chain({ data: { project_id: pid }, error: null });
    return chain(probeResult);
  });
});

describe("consultation change probe", () => {
  it("returns only the count, newest id and closed flag for staff and client, and signs no file links", async () => {
    expect(await getStaffConsultationProbe(pid)).toEqual({ count: 3, lastId: "last", closed: false, roughs: "", roughOks: "" });
    expect(await getClientConsultationProbe("x".repeat(32))).toEqual({ count: 3, lastId: "last", closed: false, roughs: "", talk: "sig1" });
    sig.read.mockResolvedValue(null);
    expect(await getClientConsultationProbe("x".repeat(32))).toEqual({ count: 3, lastId: "last", closed: false, roughs: "" });
    expect(m.signed).not.toHaveBeenCalled();
  });
  it("reports a closed or deleted project as closed", async () => {
    project = { ...project, status: "closed" };
    expect((await getStaffConsultationProbe(pid))?.closed).toBe(true);
    project = { ...project, status: "open", deleted_at: "2026-10-01T00:00:00Z" };
    expect((await getClientConsultationProbe("x".repeat(32)))?.closed).toBe(true);
  });
  it("handles an empty thread and hides a read failure as unavailable", async () => {
    probeResult = { data: [], count: 0, error: null };
    expect(await getStaffConsultationProbe(pid)).toEqual({ count: 0, lastId: null, closed: false, roughs: "", roughOks: "" });
    probeResult = { data: null, count: null, error: { message: "x" } };
    expect(await getStaffConsultationProbe(pid)).toBeNull();
  });
  it("fingerprints the rough marks so an OK changes the probe, and ignores an unreadable rough table", async () => {
    roughResult = { data: [{ id: "b", client_ok_at: null }, { id: "a", client_ok_at: "2026-10-11T00:00:00Z" }], error: null };
    expect((await getClientConsultationProbe("x".repeat(32)))?.roughs).toBe("a+,b-");
    roughResult = { data: null, error: { message: "relation does not exist" } };
    expect((await getClientConsultationProbe("x".repeat(32)))?.roughs).toBe("");
  });
  it("rejects malformed project ids and tokens before any read", async () => {
    expect(await getStaffConsultationProbe("not-a-uuid")).toBeNull();
    expect(await getClientConsultationProbe("short")).toBeNull();
  });
  it("changes the staff-only fingerprint when another tab acknowledges a rough and preserves unavailable reads", async () => {
    m.roughOks.mockResolvedValueOnce([{ id: "rough", acknowledgedAt: null }]);
    expect((await getStaffConsultationProbe(pid))?.roughOks).toBe("rough/pending");
    m.roughOks.mockResolvedValueOnce([{ id: "rough", acknowledgedAt: "2026-10-12T00:00:00Z" }]);
    expect((await getStaffConsultationProbe(pid))?.roughOks).toBe("rough/2026-10-12T00:00:00Z");
    m.roughOks.mockResolvedValueOnce(null);
    expect((await getStaffConsultationProbe(pid))?.roughOks).toBeNull();
    expect(await getClientConsultationProbe("x".repeat(32))).not.toHaveProperty("roughOks");
  });
});
