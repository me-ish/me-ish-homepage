import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), owner: vi.fn(), client: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from }) }));
vi.mock("@/features/natori/server/natoriOwner", () => ({ resolveNatoriOwnerId: m.owner }));
vi.mock("../consultationService", () => ({ getClientProject: m.client }));
vi.mock("resend", () => ({ Resend: class { emails = { send: m.send }; } }));
import { markStaffRough, recordClientRoughOk, unmarkStaffRough } from "../talkRoughService";

type Result = { data?: unknown; error?: unknown; count?: number | null };
const pid = "11111111-2222-4333-8444-555555555555";
const mid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const rid = "99999999-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ok = (data: unknown, count: number | null = null): Result => ({ data, error: null, count });
let results: Record<string, Result>;
let ops: { table: string; op: string; args: unknown[] }[];

/** Every table call resolves to results["table:firstOp"]; each op is recorded with its arguments. */
function chain(table: string) {
  let first = "";
  const query: unknown = new Proxy({}, { get(_t, key) {
    const name = String(key);
    if (name === "then") return (resolve: (value: unknown) => void) => resolve(results[`${table}:${first}`] ?? ok(null));
    if (name === "maybeSingle") return async () => results[`${table}:${first}`] ?? ok(null);
    return (...args: unknown[]) => { if (!first) first = name; ops.push({ table, op: name, args }); return query; };
  } });
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO", "staff@example.test");
  vi.stubEnv("NATORI_ORDER_MAIL_FROM", "noreply@example.test");
  vi.stubEnv("RESEND_API_KEY", "synthetic");
  ops = [];
  m.owner.mockResolvedValue("owner-1");
  m.client.mockResolvedValue({ id: pid, title: "案件A", client_name: "依頼者", status: "rough", deleted_at: null });
  m.send.mockResolvedValue({ error: null });
  results = {
    "natori_projects:select": ok({ id: pid, status: "rough", deleted_at: null }),
    "natori_consultation_messages:select": ok({ id: mid, sender: "staff" }),
    "natori_consultation_files:select": ok(null, 2),
    "natori_quotes:select": ok(null, 0),
    "natori_talk_roughs:select": ok(null),
    "natori_talk_roughs:insert": ok({ id: rid, message_id: mid, before_quote: true, created_at: "x", client_ok_at: null }),
  };
  m.from.mockImplementation((table: string) => chain(table));
});

describe("marking a rough (staff)", () => {
  it("marks a staff message with attachments and records whether any quote existed yet", async () => {
    expect(await markStaffRough(pid, mid)).toBe("ok");
    expect(ops.find(o => o.table === "natori_talk_roughs" && o.op === "insert")?.args[0]).toEqual({ project_id: pid, message_id: mid, before_quote: true });
    results["natori_quotes:select"] = ok(null, 1);
    await markStaffRough(pid, mid);
    expect(ops.filter(o => o.op === "insert").at(-1)?.args[0]).toMatchObject({ before_quote: false });
  });

  it("only accepts the owner's open project and a staff message that has files", async () => {
    expect(await markStaffRough("nope", mid)).toBe("invalid");
    m.owner.mockResolvedValueOnce(null);
    expect(await markStaffRough(pid, mid)).toBe("not-found");
    results["natori_projects:select"] = ok({ id: pid, status: "closed", deleted_at: null });
    expect(await markStaffRough(pid, mid)).toBe("closed");
    results["natori_projects:select"] = ok({ id: pid, status: "rough", deleted_at: null });
    results["natori_consultation_messages:select"] = ok({ id: mid, sender: "client" });
    expect(await markStaffRough(pid, mid)).toBe("not-found");
    results["natori_consultation_messages:select"] = ok({ id: mid, sender: "staff" });
    results["natori_consultation_files:select"] = ok(null, 0);
    expect(await markStaffRough(pid, mid)).toBe("invalid");
    expect(ops.some(o => o.op === "insert")).toBe(false);
  });

  it("is idempotent and reports an unreadable table instead of throwing", async () => {
    results["natori_talk_roughs:select"] = ok({ id: rid, message_id: mid, before_quote: true, created_at: "x", client_ok_at: null });
    expect(await markStaffRough(pid, mid)).toBe("already");
    expect(ops.some(o => o.op === "insert")).toBe(false);
    results["natori_talk_roughs:select"] = { data: null, error: { code: "42P01" } };
    expect(await markStaffRough(pid, mid)).toBe("unavailable");
  });

  it("removes the mark only while the client has not answered", async () => {
    results["natori_talk_roughs:delete"] = ok([{ id: rid }]);
    expect(await unmarkStaffRough(pid, mid)).toBe("ok");
    expect(ops.find(o => o.op === "is")?.args).toEqual(["client_ok_at", null]);
    results["natori_talk_roughs:delete"] = ok([]);
    results["natori_talk_roughs:select"] = ok({ id: rid, message_id: mid, before_quote: false, created_at: "x", client_ok_at: "2026-10-12T00:00:00Z" });
    expect(await unmarkStaffRough(pid, mid)).toBe("already");
    results["natori_talk_roughs:select"] = ok(null);
    expect(await unmarkStaffRough(pid, mid)).toBe("not-found");
  });
});

describe("recording the client's OK", () => {
  beforeEach(() => {
    results["natori_talk_roughs:update"] = ok({ id: rid, message_id: mid, before_quote: false, created_at: "x", client_ok_at: "2026-10-12T00:00:00Z" });
  });

  it("stamps the first OK of that project's rough and tells the staff inbox", async () => {
    expect(await recordClientRoughOk("tok", rid)).toBe("ok");
    const update = ops.find(o => o.op === "update");
    expect(Object.keys(update?.args[0] as object)).toEqual(["client_ok_at"]);
    expect(ops.filter(o => o.op === "eq").map(o => o.args)).toEqual([["id", rid], ["project_id", pid]]);
    expect(ops.find(o => o.op === "is")?.args).toEqual(["client_ok_at", null]);
    expect(m.send).toHaveBeenCalledTimes(1);
    const mail = m.send.mock.calls[0][0] as { to: string[]; subject: string; text: string };
    expect(mail.to).toEqual(["staff@example.test"]);
    expect(mail.subject).toContain("ラフ");
    expect(mail.text).toContain("見積もりの承認やお支払いではありません");
  });

  it("keeps the record when the notice mail fails, and sends it only once", async () => {
    m.send.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await recordClientRoughOk("tok", rid)).toBe("ok");
    m.send.mockClear();
    results["natori_talk_roughs:update"] = ok(null);
    results["natori_talk_roughs:select"] = ok({ id: rid, message_id: mid, before_quote: false, created_at: "x", client_ok_at: "2026-10-12T00:00:00Z" });
    expect(await recordClientRoughOk("tok", rid)).toBe("already");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("refuses unknown links, another project's rough, closed projects and an unreadable table", async () => {
    expect(await recordClientRoughOk("tok", "nope")).toBe("not-found");
    m.client.mockResolvedValueOnce(null);
    expect(await recordClientRoughOk("tok", rid)).toBe("not-found");
    m.client.mockResolvedValueOnce({ id: pid, title: "t", client_name: "c", status: "closed", deleted_at: null });
    expect(await recordClientRoughOk("tok", rid)).toBe("closed");
    results["natori_talk_roughs:update"] = ok(null);
    results["natori_talk_roughs:select"] = ok(null);
    expect(await recordClientRoughOk("tok", rid)).toBe("not-found");
    results["natori_talk_roughs:update"] = { data: null, error: { code: "42P01" } };
    expect(await recordClientRoughOk("tok", rid)).toBe("unavailable");
  });
});
