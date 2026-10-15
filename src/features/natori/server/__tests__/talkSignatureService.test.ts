import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from }) }));
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
  rows = {
    natori_projects: { data: { status: "open", payment_confirmed_at: null, payment_link_status: null, delivery_token_expires_at: null, delivery_accepted_at: null }, error: null },
    natori_quotes: { data: [{ id: "q1", version: 1, accepted_at: null, superseded_at: null, expires_at: "2026-11-01T00:00:00Z" }], error: null },
    natori_delivery_releases: { data: null, error: null },
    natori_payment_link_attempts: { data: null, error: null },
    natori_delivery_extensions: { data: null, error: null },
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

    rows.natori_delivery_extensions = { data: { new_expires_at: "2026-12-01T00:00:00Z" }, error: null };
    expect(await readTalkSignature("p")).not.toBe(delivered);
  });

  it("changes when a replaced legacy payment link keeps the same status, and when a deadline is crossed", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-15T00:00:00Z"));
      rows.natori_projects = { data: { ...(rows.natori_projects.data as object), payment_link_status: "sent", payment_link_url: "https://pay.example/old" }, error: null };
      const oldLink = await readTalkSignature("p");
      rows.natori_projects = { data: { ...(rows.natori_projects.data as object), payment_link_status: "sent", payment_link_url: "https://pay.example/new" }, error: null };
      expect(await readTalkSignature("p")).not.toBe(oldLink);

      const beforeDeadline = await readTalkSignature("p");
      expect(await readTalkSignature("p")).toBe(beforeDeadline);
      vi.setSystemTime(new Date("2026-11-02T00:00:00Z")); // past the quote's 2026-11-01 expiry
      expect(await readTalkSignature("p")).not.toBe(beforeDeadline);
    } finally { vi.useRealTimers(); }
  });

  it("returns null when any read fails or the project is missing, so the page does nothing", async () => {
    rows.natori_quotes = { data: null, error: { message: "boom" } };
    expect(await readTalkSignature("p")).toBeNull();
    rows.natori_quotes = { data: [], error: null };
    rows.natori_delivery_extensions = { data: null, error: { message: "boom" } };
    expect(await readTalkSignature("p")).toBeNull();
    rows.natori_delivery_extensions = { data: null, error: null };
    rows.natori_projects = { data: null, error: null };
    expect(await readTalkSignature("p")).toBeNull();
    m.from.mockImplementation(() => { throw new Error("down"); });
    expect(await readTalkSignature("p")).toBeNull();
  });
});
