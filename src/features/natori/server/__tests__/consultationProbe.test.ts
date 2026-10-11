import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), signed: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from, storage: { from: () => ({ createSignedUrl: m.signed }) } }) }));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: async () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }));
import { getClientConsultationProbe, getStaffConsultationProbe } from "../consultationService";

const pid = "11111111-2222-4333-8444-555555555555";
const owner = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
let project: Record<string, unknown> | null;
let probeResult: { data: { id: string }[] | null; count: number | null; error: unknown };

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
  project = { id: pid, user_id: owner, title: "T", client_name: "C", client_email: null, note: null, request_data: null, status: "open", deleted_at: null };
  probeResult = { data: [{ id: "last" }], count: 3, error: null };
  m.from.mockImplementation((table: string) => {
    if (table === "natori_projects") return chain({ data: project, error: null });
    if (table === "natori_consultation_access") return chain({ data: { project_id: pid }, error: null });
    return chain(probeResult);
  });
});

describe("consultation change probe", () => {
  it("returns only the count, newest id and closed flag for staff and client, and signs no file links", async () => {
    expect(await getStaffConsultationProbe(pid)).toEqual({ count: 3, lastId: "last", closed: false });
    expect(await getClientConsultationProbe("x".repeat(32))).toEqual({ count: 3, lastId: "last", closed: false });
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
    expect(await getStaffConsultationProbe(pid)).toEqual({ count: 0, lastId: null, closed: false });
    probeResult = { data: null, count: null, error: { message: "x" } };
    expect(await getStaffConsultationProbe(pid)).toBeNull();
  });
  it("rejects malformed project ids and tokens before any read", async () => {
    expect(await getStaffConsultationProbe("not-a-uuid")).toBeNull();
    expect(await getClientConsultationProbe("short")).toBeNull();
  });
});
