// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import TalkStatus from "../TalkStatus";
import { buildTalkTimeline } from "../../../lib/talkTimeline";

afterEach(cleanup);
const now = new Date("2026-10-12T03:00:00Z");
const timeline = buildTalkTimeline({
  linksAllowed: true,
  quotes: [{ id: "q1", version: 1, amount: 30000, issuedAt: "2026-10-10T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", acceptedAt: "2026-10-11T01:00:00Z", supersededAt: null }],
  payment: { confirmedAt: null, linkUrl: "https://buy.stripe.com/test_abc", linkDeadline: "2099-01-01T00:00:00Z", processing: false },
  delivery: { exists: false, expiresAt: null, acceptedAt: null, fileCount: null, openable: false },
}, now);

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const roughFacts = (okAt: string | null) => buildTalkTimeline({
  linksAllowed: true, quotes: [], payment: { confirmedAt: null, linkUrl: null, linkDeadline: null, processing: false },
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
});
