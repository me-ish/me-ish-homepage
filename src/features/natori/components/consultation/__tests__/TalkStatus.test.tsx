// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import TalkStatus from "../TalkStatus";
import { buildTalkTimeline } from "../../../lib/talkTimeline";
import type { NatoriPaymentOverview } from "../../../types/payment";
import type { TalkFacts } from "../../../types/talk";

afterEach(cleanup);
const now = new Date("2026-10-12T03:00:00Z");
const timelineFacts: TalkFacts = {
  linksAllowed: true,
  quotes: [{ id: "q1", version: 1, amount: 30000, issuedAt: "2026-10-10T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", acceptedAt: "2026-10-11T01:00:00Z", supersededAt: null }],
  payment: { confirmedAt: null, link: { kind: "generation", state: "active", url: "https://buy.stripe.com/test_abc", deadline: "2099-01-01T00:00:00Z" } },
  delivery: { exists: false, expiresAt: null, acceptedAt: null, fileCount: null, openable: false },
};
const timeline = buildTalkTimeline(timelineFacts, now);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const roughFacts = (okAt: string | null) => buildTalkTimeline({
  linksAllowed: true, quotes: [], payment: { confirmedAt: null },
  delivery: { exists: false, expiresAt: null, acceptedAt: null, fileCount: null, openable: false },
  roughs: [{ id: "r1", messageId: "m1", beforeQuote: true, createdAt: "2026-10-11T00:00:00Z", okAt }],
}, now);

describe("TalkStatus", () => {
  it("shows a rough with its OK button, and the answered rough without one", () => {
    render(<TalkStatus timeline={roughFacts(null)} token="synthetic" />);
    expect(screen.getByText("参考ラフ（見積もり前）")).toBeTruthy();
    expect(screen.getByRole("button", { name: "このラフでOK" })).toBeTruthy();
    cleanup();
    render(<TalkStatus timeline={roughFacts("2026-10-12T01:00:00Z")} token="synthetic" />);
    expect(screen.getByText("OK済み")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lists the three steps and the cards", () => {
    render(<TalkStatus timeline={timeline} token="synthetic" />);
    const steps = within(screen.getByRole("list", { name: "進み具合" })).getAllByRole("listitem").map(li => li.textContent);
    expect(steps).toEqual(["見積もり承認（済み）", "お支払い（まだ）", "納品（まだ）"]);
    expect(screen.getByText("承認済み")).toBeTruthy();
    expect(screen.getByText("支払い待ち")).toBeTruthy();
  });

  it("renders the only action as an external Stripe link and adds no other buttons", () => {
    render(<TalkStatus timeline={timeline} token="synthetic" />);
    const link = screen.getByRole("link", { name: "お支払いへ進む" });
    expect(link.getAttribute("href")).toBe("https://buy.stripe.com/test_abc");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it.each(["review", "processing", "unavailable", "paid", "paid-review", "terminal", "inactive", "stop_required", "deactivating", "creating", "legacy_review", "needs_review", "expired", "unknown", "boundary"])("does not leak hrefs for %s payment guidance", state => {
    const payment: NatoriPaymentOverview = { available: state !== "unavailable", confirmedAt: state.startsWith("paid") ? "2026-10-12T01:00:00Z" : null,
      requiresReview: state === "review" || state === "paid-review", processing: state === "processing", linkState: ["review", "processing", "unavailable", "paid", "paid-review", "boundary"].includes(state) ? "active" : state,
      linkUrl: "https://buy.stripe.com/test_abc", linkDeadline: state === "boundary" ? now.toISOString() : "2099-01-01T00:00:00Z" };
    const closed = buildTalkTimeline({ linksAllowed: true, quotes: [{ id: "q1", version: 1, amount: 30000, issuedAt: "2026-10-10T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", acceptedAt: "2026-10-11T01:00:00Z", supersededAt: null }],
      payment: { overview: payment, link: { kind: "generation", state: "active", url: payment.linkUrl ?? null, deadline: payment.linkDeadline ?? null } },
      delivery: { exists: false, expiresAt: null, acceptedAt: null, fileCount: null, openable: false } }, now);
    const { container } = render(<TalkStatus timeline={closed} token="synthetic" />);
    expect(screen.queryByRole("link", { name: "お支払いへ進む" })).toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
    expect(screen.getByText("承認済み")).toBeTruthy();
    if (state === "paid-review") { expect(screen.getByText("支払い完了")).toBeTruthy();expect(screen.getByText(/追加のお支払いはせず/)).toBeTruthy(); }
  });

  it("renders a closed project without any action or href", () => {
    const closed = buildTalkTimeline({ ...timelineFacts, linksAllowed: false }, now);
    const { container } = render(<TalkStatus timeline={closed} token="synthetic" />);
    expect(container.querySelector("[href]")).toBeNull();expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("uses the latest terminal overview to remove quote, rough and paid-delivery actions", () => {
    const latest = buildTalkTimeline({ ...timelineFacts, quotes: timelineFacts.quotes.map(quote => ({ ...quote, acceptedAt: null })),
      roughs: [{ id: "r1", messageId: "m1", beforeQuote: false, createdAt: "2026-10-11T00:00:00Z", okAt: null }],
      payment: { overview: { available: true, confirmedAt: "2026-10-12T01:00:00Z", requiresReview: false, processing: false, linkState: "terminal" } },
      delivery: { exists: true, expiresAt: "2099-01-01T00:00:00Z", acceptedAt: null, fileCount: 1, openable: true } }, now);
    const { container } = render(<TalkStatus timeline={latest} token="synthetic" />);
    expect(screen.getByText("支払い完了")).toBeTruthy();expect(container.querySelector("[href]")).toBeNull();expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
