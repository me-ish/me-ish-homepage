import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), project: vi.fn(), overview: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: m.from, rpc: m.rpc }) }));
vi.mock("../consultationService", () => ({ getClientProject: m.project }));
vi.mock("../paymentReadModelService", () => ({ getQuotePaymentOverview: m.overview }));
import { getClientTalkTimeline } from "../talkTimelineService";

type Result = { data: unknown; error: unknown };
const pid = "11111111-2222-4333-8444-555555555555";
let rows: Record<string, Result>;
const writes = vi.fn();

function chain(result: Result) {
  const query: unknown = new Proxy({}, { get(_t, key) {
    if (key === "then") return (resolve: (value: unknown) => void) => resolve(result);
    if (key === "maybeSingle") return async () => result;
    if (["insert", "update", "upsert", "delete"].includes(String(key))) return () => { writes(String(key)); return query; };
    return () => query;
  } });
  return query;
}
const ok = (data: unknown): Result => ({ data, error: null });
const token = "x".repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  m.project.mockResolvedValue({ id: pid, deleted_at: null });
  m.overview.mockResolvedValue(undefined);
  rows = {
    natori_projects: ok({ payment_confirmed_at: null, payment_link_url: null, payment_link_status: null, delivery_token_expires_at: null, delivery_accepted_at: null }),
    natori_quotes: ok([{ id: "q1", version: 1, amount: 30000, created_at: "2026-10-10T00:00:00Z", issued_at: null, expires_at: "2099-01-01T00:00:00Z", accepted_at: "2026-10-11T00:00:00Z", superseded_at: null }]),
    natori_delivery_releases: ok(null),
    natori_payment_link_attempts: ok(null),
  };
  m.from.mockImplementation((table: string) => chain(rows[table] ?? ok(null)));
});

describe("client talk timeline service", () => {
  it("builds cards from stored rows and writes nothing", async () => {
    rows.natori_payment_link_attempts = ok({ state: "active", link_url: "https://buy.stripe.com/test_abc", deadline: "2099-01-01T00:00:00Z" });
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards.map(c => c.kind)).toEqual(["quote", "payment"]);
    expect(timeline?.cards[1].action).toMatchObject({ href: "https://buy.stripe.com/test_abc" });
    expect(writes).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });

  it("does not show a stored project link once a generation row says it is no longer active", async () => {
    rows.natori_projects = ok({ payment_confirmed_at: null, payment_link_url: "https://buy.stripe.com/old", payment_link_status: "ready", delivery_token_expires_at: null, delivery_accepted_at: null });
    rows.natori_payment_link_attempts = ok({ state: "inactive", link_url: "https://buy.stripe.com/old", deadline: "2099-01-01T00:00:00Z" });
    expect((await getClientTalkTimeline(token))?.cards.map(c => c.kind)).toEqual(["quote"]);
  });

  it("falls back to the project link only while no generation row exists", async () => {
    rows.natori_projects = ok({ payment_confirmed_at: null, payment_link_url: "https://buy.stripe.com/legacy", payment_link_status: "sent", delivery_token_expires_at: null, delivery_accepted_at: null });
    expect((await getClientTalkTimeline(token))?.cards[1].action).toMatchObject({ href: "https://buy.stripe.com/legacy" });
    rows.natori_projects = ok({ payment_confirmed_at: null, payment_link_url: "https://buy.stripe.com/legacy", payment_link_status: "void", delivery_token_expires_at: null, delivery_accepted_at: null });
    expect((await getClientTalkTimeline(token))?.cards.map(c => c.kind)).toEqual(["quote"]);
  });

  it("reports a legacy delivery and a release with its file count", async () => {
    rows.natori_projects = ok({ payment_confirmed_at: "2026-10-12T00:00:00Z", payment_link_url: null, payment_link_status: "paid", delivery_token_expires_at: "2099-01-01T00:00:00Z", delivery_accepted_at: null });
    const legacy = await getClientTalkTimeline(token);
    expect(legacy?.cards.at(-1)).toMatchObject({ kind: "delivery", badge: { label: "受け取り待ち" } });
    rows.natori_delivery_releases = ok({ expires_at: "2099-01-01T00:00:00Z", accepted_at: null, manifest: [{}, {}, {}] });
    expect((await getClientTalkTimeline(token))?.cards.at(-1)?.lines).toContain("ファイル 3点");
  });

  it("shows a payment in confirmation without a button", async () => {
    rows.natori_payment_link_attempts = ok({ state: "active", link_url: "https://buy.stripe.com/test_abc", deadline: "2099-01-01T00:00:00Z" });
    m.overview.mockResolvedValue({ available: true, confirmedAt: null, requiresReview: false, processing: true });
    expect((await getClientTalkTimeline(token))?.cards[1]).toMatchObject({ badge: { label: "確認中" } });
  });

  it("adds rough cards from stored rows, shows a rough even without quotes, and ignores an unreadable rough table", async () => {
    rows.natori_talk_roughs = ok([{ id: "r1", message_id: "m1", before_quote: false, created_at: "2026-10-11T00:00:00Z", client_ok_at: null }]);
    expect((await getClientTalkTimeline(token))?.cards.map(c => c.kind)).toEqual(["quote", "rough"]);
    rows.natori_quotes = ok([]);
    rows.natori_talk_roughs = ok([{ id: "r1", message_id: "m1", before_quote: true, created_at: "2026-10-11T00:00:00Z", client_ok_at: "2026-10-12T00:00:00Z" }]);
    expect((await getClientTalkTimeline(token))?.cards[0]).toMatchObject({ kind: "rough", title: "参考ラフ（見積もり前）", badge: { label: "OK済み" } });
    rows.natori_quotes = ok([{ id: "q1", version: 1, amount: 30000, created_at: "2026-10-10T00:00:00Z", issued_at: null, expires_at: "2099-01-01T00:00:00Z", accepted_at: "2026-10-11T00:00:00Z", superseded_at: null }]);
    rows.natori_talk_roughs = { data: null, error: { code: "42P01" } };
    expect((await getClientTalkTimeline(token))?.cards.map(c => c.kind)).toEqual(["quote"]);
    expect(writes).not.toHaveBeenCalled();
  });

  it("returns null for an unknown, deleted or empty project and survives read failures", async () => {
    m.project.mockResolvedValueOnce(null);
    expect(await getClientTalkTimeline(token)).toBeNull();
    m.project.mockResolvedValueOnce({ id: pid, deleted_at: "2026-10-01T00:00:00Z" });
    expect(await getClientTalkTimeline(token)).toBeNull();
    rows.natori_quotes = ok([]);
    expect(await getClientTalkTimeline(token)).toBeNull();
    rows.natori_quotes = { data: null, error: { message: "x" } };
    expect(await getClientTalkTimeline(token)).toBeNull();
    m.from.mockImplementation(() => { throw new Error("boom"); });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await getClientTalkTimeline(token)).toBeNull();
  });
});
