import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), owner: vi.fn(), client: vi.fn(), send: vi.fn(), schedule: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from, rpc: m.rpc }) }));
vi.mock("../scheduleAcceptanceNotifications", () => ({ scheduleAcceptanceNotifications: m.schedule }));
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
  const token = "a".repeat(32);
  const notice = "88888888-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const stamp = "2026-10-12T00:00:00Z";
  const row = (patch: Record<string, unknown> = {}) => ({ result: "ok", project_id: pid, rough_id: rid, client_ok_at: stamp, notification_ids: [notice], ...patch });
  beforeEach(() => { m.rpc.mockResolvedValue({ data: [row()], error: null }); m.schedule.mockReset(); });

  it("commits the OK with a durable job and schedules the saved notification instead of sending directly", async () => {
    expect(await recordClientRoughOk(token, rid)).toBe("ok");
    expect(m.rpc).toHaveBeenCalledWith("natori_record_rough_ok_v1", { p_project_id: pid, p_rough_id: rid, p_token_hash: createHash("sha256").update(token).digest("hex") });
    expect(JSON.stringify(m.rpc.mock.calls)).not.toContain(token);
    expect(m.schedule).toHaveBeenCalledWith([notice]);
    expect(m.send).not.toHaveBeenCalled();
    expect(ops).toEqual([]);
  });

  it("replays the same unresolved job, while sent and historical OKs do not schedule a job", async () => {
    m.rpc.mockResolvedValue({ data: [row({ result: "already_ok" })], error: null });
    expect(await recordClientRoughOk(token, rid)).toBe("already");
    expect(m.schedule).toHaveBeenLastCalledWith([notice]);
    m.rpc.mockResolvedValue({ data: [row({ result: "already_ok", notification_ids: [] })], error: null });
    expect(await recordClientRoughOk(token, rid)).toBe("already");
    expect(m.schedule).toHaveBeenLastCalledWith([]);
    expect(m.send).not.toHaveBeenCalled();
    expect(ops).toEqual([]);
  });

  it("concurrent responses schedule the same logical job and survive missing mail configuration or scheduling failure", async () => {
    vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("NATORI_ORDER_MAIL_FROM", "");
    expect(await Promise.all([recordClientRoughOk(token, rid), recordClientRoughOk(token, rid)])).toEqual(["ok", "ok"]);
    expect(m.schedule.mock.calls).toEqual([[[notice]], [[notice]]]);
    m.schedule.mockImplementation(() => { throw new Error("worker stopped"); });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await recordClientRoughOk(token, rid)).toBe("ok");
    expect(m.send).not.toHaveBeenCalled(); spy.mockRestore();
  });

  it("rejects malformed token/rough, absent or deleted project without any write", async () => {
    expect(await recordClientRoughOk(token, "nope")).toBe("not-found");
    expect(await recordClientRoughOk("short", rid)).toBe("not-found");
    expect(m.client).not.toHaveBeenCalled();
    m.client.mockResolvedValueOnce(null);
    expect(await recordClientRoughOk(token, rid)).toBe("not-found");
    m.client.mockResolvedValueOnce({ id: pid, deleted_at: stamp });
    expect(await recordClientRoughOk(token, rid)).toBe("not-found");
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("trusts only the transaction's current capability/binding checks, including expiry and closure after a project read", async () => {
    m.rpc.mockResolvedValue({ data: [row({ result: "not_found", rough_id: null, project_id: null, client_ok_at: null, notification_ids: [] })], error: null });
    expect(await recordClientRoughOk(token, rid)).toBe("not-found");
    m.rpc.mockResolvedValue({ data: [row({ result: "closed", notification_ids: [] })], error: null });
    expect(await recordClientRoughOk(token, rid)).toBe("closed");
    expect(m.schedule).not.toHaveBeenCalled(); expect(ops).toEqual([]);
  });

  it.each([null, [], [row(), row()], [row({ result: "invented" })], [row({ rough_id: mid })], [row({ project_id: mid })],
    [row({ client_ok_at: null })], [row({ client_ok_at: "bad" })], [row({ notification_ids: [] })], [row({ notification_ids: [notice, notice] })],
    [row({ notification_ids: ["bad"] })], [row({ notification_ids: null })], [row({ result: "not_found" })]])("fails closed on a malformed RPC response %#", async data => {
    m.rpc.mockResolvedValue({ data, error: null });
    expect(await recordClientRoughOk(token, rid)).toBe("unavailable");
    expect(m.schedule).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled(); expect(ops).toEqual([]);
  });

  it("missing RPC and unexpected errors never fall back to a direct write/send", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await recordClientRoughOk(token, rid)).toBe("unavailable");
    m.rpc.mockRejectedValueOnce(new Error("private"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await recordClientRoughOk(token, rid)).toBe("unavailable");
    expect(spy).toHaveBeenCalledWith("[natori-talk] rough ok unavailable");
    spy.mockRestore(); expect(m.send).not.toHaveBeenCalled(); expect(ops).toEqual([]);
  });
  it.each([null, undefined, {}, { data: [row()] }, { data: [row()], error: false }, { data: [row()], error: undefined }])("fails closed on malformed response envelope %#", async response => {
    m.rpc.mockResolvedValue(response);
    expect(await recordClientRoughOk(token, rid)).toBe("unavailable");
    expect(m.schedule).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled(); expect(ops).toEqual([]);
  });
});
