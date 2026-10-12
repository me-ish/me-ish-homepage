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
  m.project.mockResolvedValue({ id: pid, deleted_at: null, status: "awaiting_payment" });
  m.overview.mockResolvedValue(undefined);
  rows = {
    natori_projects: ok({ status: "awaiting_payment", deleted_at: null, payment_confirmed_at: null, payment_link_url: null, payment_link_status: null, delivery_token_expires_at: null, delivery_accepted_at: null }),
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
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards[1]).toMatchObject({ badge: { label: "案内停止" } });
    expect(timeline?.cards[1].action).toBeUndefined();
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

  it("never prompts payment while the authoritative inbox requires review, even with an active generation", async () => {
    rows.natori_payment_link_attempts = ok({ state: "active", link_url: "https://buy.stripe.com/test_abc", deadline: "2099-01-01T00:00:00Z" });
    m.overview.mockResolvedValue({ available: true, confirmedAt: null, requiresReview: true, processing: false });
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards.find(card => card.kind === "payment")?.action).toBeUndefined();
    expect(timeline?.cards.find(card => card.kind === "payment")?.lines.join("")).toContain("追加のお支払いはせず");
  });

  it("does not turn a failed generation read into successful legacy no-row fallback", async () => {
    rows.natori_projects = ok({ payment_confirmed_at: null, payment_link_url: "https://buy.stripe.com/legacy", payment_link_status: "ready", delivery_token_expires_at: null, delivery_accepted_at: null });
    rows.natori_payment_link_attempts = { data: null, error: { code: "READ_FAILED" } };
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards[0].kind).toBe("quote");
    expect(timeline?.cards.find(card => card.kind === "payment")?.action).toBeUndefined();
    expect(JSON.stringify(timeline)).not.toContain("https://buy.stripe.com/legacy");
  });

  it.each(["ready", "sent"])("also blocks inbox review with a successful legacy %s no-row read", async status => {
    rows.natori_projects = ok({ ...rows.natori_projects.data as object, payment_link_url: "https://buy.stripe.com/legacy", payment_link_status: status });
    m.overview.mockResolvedValue({ available: true, confirmedAt: null, requiresReview: true, processing: false });
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards.find(card => card.kind === "payment")).toMatchObject({ badge: { label: "照合中" } });
    expect(JSON.stringify(timeline)).not.toContain("https://buy.stripe.com/legacy");
  });

  it("retains quote, rough and delivery cards after thrown attempt or overview reads", async () => {
    rows.natori_talk_roughs = ok([{ id: "r1", message_id: "m1", before_quote: false, created_at: "2026-10-11T00:00:00Z", client_ok_at: null }]);
    rows.natori_delivery_releases = ok({ expires_at: "2099-01-01T00:00:00Z", accepted_at: null, manifest: [{}] });
    m.from.mockImplementation((table: string) => { if (table === "natori_payment_link_attempts") throw new Error("fixture attempt read"); return chain(rows[table] ?? ok(null)); });
    m.overview.mockRejectedValue(new Error("fixture overview read"));
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards.map(card => card.kind)).toEqual(["quote", "rough", "payment", "delivery"]);
    expect(timeline?.cards.find(card => card.kind === "payment")).toMatchObject({ badge: { label: "確認中" } });
    expect(timeline?.cards.find(card => card.kind === "payment")?.action).toBeUndefined();
    expect(timeline?.steps.find(step => step.key === "payment")?.done).toBe(false);
    expect(writes).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();
  });

  it("rejects asynchronous attempt read failure while keeping a quote card", async () => {
    rows.natori_projects = ok({ ...rows.natori_projects.data as object, payment_link_url: "https://buy.stripe.com/legacy", payment_link_status: "ready" });
    m.from.mockImplementation((table: string) => table === "natori_payment_link_attempts"
      ? { select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.reject(new Error("fixture rejected attempt")) }) }) }) }) }
      : chain(rows[table] ?? ok(null)));
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards[0].kind).toBe("quote");expect(JSON.stringify(timeline)).not.toContain("https://buy.stripe.com/legacy");
  });

  it.each([[], {}, {state:"active",link_url:123,deadline:"2099-01-01T00:00:00Z"}, {state:"unknown",link_url:"https://buy.stripe.com/synthetic",deadline:"2099-01-01T00:00:00Z"}])("never revives legacy after malformed attempt row %#", async data => {
    rows.natori_projects = ok({ ...rows.natori_projects.data as object, payment_link_url: "https://buy.stripe.com/legacy", payment_link_status: "ready" });
    rows.natori_payment_link_attempts = ok(data);
    expect(JSON.stringify(await getClientTalkTimeline(token))).not.toContain("https://buy.stripe.com/legacy");
  });

  it.each([null, {}, { data: null }, { data: null, error: undefined }, { data: null, error: false }])("keeps other cards and never treats malformed attempt response %# as successful no-row", async response => {
    rows.natori_projects = ok({ ...rows.natori_projects.data as object, payment_link_url: "https://buy.stripe.com/legacy", payment_link_status: "ready" });
    m.from.mockImplementation((table: string) => table === "natori_payment_link_attempts" ? chain(response as Result) : chain(rows[table] ?? ok(null)));
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards[0].kind).toBe("quote");
    expect(JSON.stringify(timeline)).not.toContain("https://buy.stripe.com/legacy");
    expect(timeline?.cards.find(card => card.kind === "payment")?.action).toBeUndefined();
  });

  it("uses confirmation arriving after the project read, with the review warning and no CTA", async () => {
    rows.natori_payment_link_attempts = ok({ state: "active", link_url: "https://buy.stripe.com/synthetic", deadline: "2099-01-01T00:00:00Z" });
    m.overview.mockResolvedValue({ available: true, confirmedAt: "2026-10-12T01:00:00Z", requiresReview: true, processing: false, linkState: "active", linkUrl: "https://buy.stripe.com/synthetic", linkDeadline: "2099-01-01T00:00:00Z" });
    const timeline = await getClientTalkTimeline(token);
    const pay = timeline?.cards.find(card => card.kind === "payment");
    expect(pay).toMatchObject({ badge: { label: "支払い完了" } });
    expect(pay?.lines.join("")).toContain("追加のお支払いはせず");expect(pay?.action).toBeUndefined();
    expect(timeline?.steps.find(step => step.key === "payment")?.done).toBe(true);
  });

  it("blocks links if the later project read became closed/deleted, and leaves completed projects usable", async () => {
    rows.natori_payment_link_attempts = ok({ state: "active", link_url: "https://buy.stripe.com/synthetic", deadline: "2099-01-01T00:00:00Z" });
    rows.natori_projects = ok({ ...rows.natori_projects.data as object, status: "closed" });
    expect((await getClientTalkTimeline(token))?.cards.every(card => !card.action)).toBe(true);
    rows.natori_projects = ok({ ...rows.natori_projects.data as object, status: "completed" });
    expect((await getClientTalkTimeline(token))?.cards.find(card => card.kind === "payment")?.action).toMatchObject({ href: "https://buy.stripe.com/synthetic" });
    rows.natori_projects = ok({ ...rows.natori_projects.data as object, deleted_at: "2026-10-12T01:00:00Z" });
    expect(await getClientTalkTimeline(token)).toBeNull();
  });

  it("keeps paid facts but blocks every action when the latest overview sees terminal after earlier open reads", async () => {
    rows.natori_quotes = ok([{ id: "q1", version: 1, amount: 30000, created_at: "2026-10-10T00:00:00Z", issued_at: null, expires_at: "2099-01-01T00:00:00Z", accepted_at: null, superseded_at: null }]);
    rows.natori_talk_roughs = ok([{ id: "r1", message_id: "m1", before_quote: false, created_at: "2026-10-11T00:00:00Z", client_ok_at: null }]);
    rows.natori_delivery_releases = ok({ expires_at: "2099-01-01T00:00:00Z", accepted_at: null, manifest: [{}] });
    m.overview.mockResolvedValue({ available: true, confirmedAt: "2026-10-12T01:00:00Z", requiresReview: false, processing: false, linkState: "terminal", linkUrl: null, linkDeadline: null });
    const timeline = await getClientTalkTimeline(token);
    expect(timeline?.cards.map(card => card.kind)).toEqual(["quote", "rough", "payment", "delivery"]);
    expect(timeline?.cards.every(card => !card.action)).toBe(true);
    expect(timeline?.steps.find(step => step.key === "payment")?.done).toBe(true);
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
