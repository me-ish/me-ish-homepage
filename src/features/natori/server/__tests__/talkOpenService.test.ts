import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
// Domain tests use an unheld admission boundary; actual denial/SQL are covered separately.
vi.mock("../caseSystemHold",()=>({assertCaseSystemAdmission:vi.fn(async()=>{})}));
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), project: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from }) }));
vi.mock("../consultationService", () => ({ getClientProject: m.project }));
import { openTalkLink, OPEN_LINKS_PER_HOUR } from "../talkOpenService";

type Result = { data?: unknown; error?: unknown; count?: number | null };
const pid = "11111111-2222-4333-8444-555555555555";
const token = "x".repeat(32);
const future = "2099-01-01T00:00:00Z";
let tables: Record<string, Result>;
let inserts: { table: string; row: Record<string, unknown> }[];
let selects: Record<string, number>;

function chain(table: string, result: Result) {
  const query: unknown = new Proxy({}, { get(_t, key) {
    if (key === "then") return (resolve: (value: unknown) => void) => resolve(result);
    if (key === "maybeSingle") return async () => result;
    if (key === "insert") return async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: (tables[`${table}:insert`] ?? {}).error ?? null }; };
    return () => query;
  } });
  return query;
}
const ok = (data: unknown): Result => ({ data, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  inserts = []; selects = {};
  m.project.mockResolvedValue({ id: pid, status: "quoted", deleted_at: null });
  tables = {
    natori_projects: ok({ active_quote_id: "q1", payment_confirmed_at: "2026-10-12T00:00:00Z" }),
    natori_quotes: ok({ id: "q1", project_id: pid, expires_at: future, accepted_at: null, superseded_at: null }),
    natori_quote_access: { data: null, error: null, count: 0 },
    natori_delivery_releases: ok({ id: "r1", expires_at: future }),
    natori_delivery_access: { data: null, error: null, count: 0 },
  };
  m.from.mockImplementation((table: string) => { selects[table] = (selects[table] ?? 0) + 1; return chain(table, tables[table] ?? ok(null)); });
});

describe("opening a quote or delivery page from the talk", () => {
  it("adds one quote access row with the original expiry and returns its path", async () => {
    const result = await openTalkLink(token, "quote");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const fresh = result.path.replace("/natori/quote/", "");
    expect(fresh).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(inserts).toEqual([{ table: "natori_quote_access", row: { token_hash: createHash("sha256").update(fresh).digest("hex"), quote_id: "q1", expires_at: future } }]);
  });

  it("adds one delivery access row that expires with the release and returns its path", async () => {
    const result = await openTalkLink(token, "delivery");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.path.startsWith("/natori/delivery/")).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ table: "natori_delivery_access", row: { release_id: "r1", expires_at: future } });
  });

  it("refuses a quote that is accepted, replaced, expired or no longer the active one", async () => {
    for (const change of [{ accepted_at: "2026-10-11T00:00:00Z" }, { superseded_at: "2026-10-11T00:00:00Z" }, { expires_at: "2020-01-01T00:00:00Z" }, { project_id: "other" }]) {
      tables.natori_quotes = ok({ id: "q1", project_id: pid, expires_at: future, accepted_at: null, superseded_at: null, ...change });
      expect(await openTalkLink(token, "quote")).toEqual({ kind: "unavailable" });
    }
    tables.natori_projects = ok({ active_quote_id: null });
    expect(await openTalkLink(token, "quote")).toEqual({ kind: "unavailable" });
    expect(inserts).toEqual([]);
  });

  it("refuses a delivery before payment, without a release, or after the release expired", async () => {
    tables.natori_projects = ok({ payment_confirmed_at: null });
    expect(await openTalkLink(token, "delivery")).toEqual({ kind: "unavailable" });
    tables.natori_projects = ok({ payment_confirmed_at: "2026-10-12T00:00:00Z" });
    tables.natori_delivery_releases = ok(null);
    expect(await openTalkLink(token, "delivery")).toEqual({ kind: "unavailable" });
    tables.natori_delivery_releases = ok({ id: "r1", expires_at: "2020-01-01T00:00:00Z" });
    expect(await openTalkLink(token, "delivery")).toEqual({ kind: "unavailable" });
    expect(inserts).toEqual([]);
  });

  it("throttles after the hourly limit and refuses closed, deleted or unknown projects", async () => {
    tables.natori_quote_access = { data: null, error: null, count: OPEN_LINKS_PER_HOUR };
    tables.natori_delivery_access = { data: null, error: null, count: OPEN_LINKS_PER_HOUR };
    expect(await openTalkLink(token, "quote")).toEqual({ kind: "throttled" });
    expect(await openTalkLink(token, "delivery")).toEqual({ kind: "throttled" });
    m.project.mockResolvedValueOnce({ id: pid, status: "closed", deleted_at: null });
    expect(await openTalkLink(token, "quote")).toEqual({ kind: "unavailable" });
    m.project.mockResolvedValueOnce({ id: pid, status: "quoted", deleted_at: "2026-10-01T00:00:00Z" });
    expect(await openTalkLink(token, "quote")).toEqual({ kind: "not-found" });
    m.project.mockResolvedValueOnce(null);
    expect(await openTalkLink(token, "delivery")).toEqual({ kind: "not-found" });
    expect(inserts).toEqual([]);
  });

  it("reports read and insert failures as db errors and never throws", async () => {
    tables["natori_quote_access:insert"] = { error: { message: "x" } };
    expect(await openTalkLink(token, "quote")).toEqual({ kind: "db-error" });
    tables.natori_quotes = { data: null, error: { message: "x" } };
    expect(await openTalkLink(token, "quote")).toEqual({ kind: "db-error" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.from.mockImplementation(() => { throw new Error("boom"); });
    expect(await openTalkLink(token, "delivery")).toEqual({ kind: "db-error" });
  });
});
