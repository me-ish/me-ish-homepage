import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), extension: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from }) }));
vi.mock("../deliveryExpiry", () => ({ readLatestDeliveryExtension: m.extension }));
import { readTalkSignature } from "../talkSignatureService";

type Result = { data: unknown; error: unknown };
let rows: Record<string, Result>;
function chain(result: Result) {
  const query: unknown = new Proxy({}, { get(_target, key) {
    if (key === "then") return (resolve: (value: Result) => void) => resolve(result);
    if (key === "maybeSingle") return async () => result;
    return () => query;
  } });
  return query;
}

beforeEach(() => {
  m.extension.mockResolvedValue(null);
  rows = {
    natori_projects: { data: { status: "open", payment_confirmed_at: null, payment_link_status: null, delivery_token_expires_at: null, delivery_accepted_at: null }, error: null },
    natori_quotes: { data: [{ id: "q1", version: 1, accepted_at: null, superseded_at: null, expires_at: "2026-11-01T00:00:00Z" }], error: null },
    natori_delivery_releases: { data: null, error: null },
    natori_payment_link_attempts: { data: null, error: null },
  };
  m.from.mockImplementation((table: string) => chain(rows[table]));
});

describe("readTalkSignature", () => {
  it("is stable while nothing changes and changes with quote, payment, delivery and extension state", async () => {
    const base = await readTalkSignature("p");
    expect(base).toMatch(/^[0-9a-f]{16}$/);
    expect(await readTalkSignature("p")).toBe(base);

    rows.natori_quotes = { data: [{ id: "q1", version: 1, accepted_at: "2026-10-15T00:00:00Z", superseded_at: null, expires_at: "2026-11-01T00:00:00Z" }], error: null };
    const accepted = await readTalkSignature("p");
    expect(accepted).not.toBe(base);

    rows.natori_payment_link_attempts = { data: { state: "active", deadline: "2026-10-16T00:20:00Z", link_url: "https://pay.example/x" }, error: null };
    const linked = await readTalkSignature("p");
    expect(linked).not.toBe(accepted);

    rows.natori_projects = { data: { ...(rows.natori_projects.data as object), payment_confirmed_at: "2026-10-15T01:00:00Z" }, error: null };
    const paid = await readTalkSignature("p");
    expect(paid).not.toBe(linked);

    rows.natori_delivery_releases = { data: { expires_at: "2026-11-15T00:00:00Z", accepted_at: null, manifest: [{}, {}] }, error: null };
    const delivered = await readTalkSignature("p");
    expect(delivered).not.toBe(paid);

    m.extension.mockResolvedValue("2026-12-01T00:00:00Z");
    expect(await readTalkSignature("p")).not.toBe(delivered);
  });

  it("returns null when any read fails or the project is missing, so the page does nothing", async () => {
    rows.natori_quotes = { data: null, error: { message: "boom" } };
    expect(await readTalkSignature("p")).toBeNull();
    rows.natori_quotes = { data: [], error: null };
    rows.natori_projects = { data: null, error: null };
    expect(await readTalkSignature("p")).toBeNull();
    m.from.mockImplementation(() => { throw new Error("down"); });
    expect(await readTalkSignature("p")).toBeNull();
  });
});
