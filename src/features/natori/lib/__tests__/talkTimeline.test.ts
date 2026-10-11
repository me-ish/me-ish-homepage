import { describe, expect, it } from "vitest";
import { buildTalkTimeline, isStripePaymentUrl } from "../talkTimeline";
import type { TalkFacts, TalkQuoteFact } from "../../types/talk";

const now = new Date("2026-10-12T03:00:00Z");
const quote = (over: Partial<TalkQuoteFact> = {}): TalkQuoteFact => ({ id: "q1", version: 1, amount: 30000, issuedAt: "2026-10-10T00:00:00Z", expiresAt: "2026-10-18T14:59:59Z", acceptedAt: null, supersededAt: null, ...over });
const facts = (over: Partial<TalkFacts> = {}): TalkFacts => ({
  linksAllowed: true, quotes: [], payment: { confirmedAt: null, linkUrl: null, linkDeadline: null, processing: false },
  delivery: { exists: false, expiresAt: null, acceptedAt: null, fileCount: null, openable: true }, ...over,
});
const labels = (f: TalkFacts) => buildTalkTimeline(f, now).cards.map(card => `${card.kind}:${card.badge.label}`);

describe("talk timeline", () => {
  it("shows nothing before anything was sent", () => {
    expect(buildTalkTimeline(facts(), now).cards).toEqual([]);
  });

  it("shows an open quote with its amount and deadline and a button that opens the approval page", () => {
    const [card] = buildTalkTimeline(facts({ quotes: [quote()] }), now).cards;
    expect(card).toMatchObject({ kind: "quote", amount: "¥30,000", badge: { label: "確認待ち", tone: "action" }, action: { label: "内容を確認して承認", open: "quote" } });
    expect(card.lines.join("")).toContain("10月18日まで有効");
  });

  it("falls back to the mail hint without a button once the project is closed", () => {
    const [card] = buildTalkTimeline(facts({ linksAllowed: false, quotes: [quote()] }), now).cards;
    expect(card.action).toBeUndefined();
    expect(card.lines.join("")).toContain("メールにあるリンク");
  });

  it("marks an accepted quote, an expired one and an older one that was replaced", () => {
    expect(labels(facts({ quotes: [quote({ acceptedAt: "2026-10-11T01:00:00Z" })] }))).toEqual(["quote:承認済み"]);
    expect(labels(facts({ quotes: [quote({ expiresAt: "2026-10-11T00:00:00Z" })] }))).toEqual(["quote:期限切れ"]);
    expect(labels(facts({ quotes: [quote({ supersededAt: "2026-10-11T00:00:00Z" }), quote({ id: "q2", version: 2 })] }))).toEqual(["quote:更新済み", "quote:確認待ち"]);
  });

  it("offers the payment button only after approval, only for a Stripe URL and only before the deadline", () => {
    const accepted = quote({ acceptedAt: "2026-10-11T01:00:00Z" });
    const link = { confirmedAt: null, linkUrl: "https://buy.stripe.com/test_abc", linkDeadline: "2026-10-20T00:00:00Z", processing: false };
    const [, pay] = buildTalkTimeline(facts({ quotes: [accepted], payment: link }), now).cards;
    expect(pay).toMatchObject({ kind: "payment", amount: "¥30,000", badge: { label: "支払い待ち" }, action: { label: "お支払いへ進む", href: "https://buy.stripe.com/test_abc" } });
    // No approval, no payment card at all.
    expect(buildTalkTimeline(facts({ quotes: [quote()], payment: link }), now).cards.map(c => c.kind)).toEqual(["quote"]);
    // Foreign host or plain http never becomes a button.
    for (const linkUrl of ["https://evil.example/pay", "http://buy.stripe.com/x", "javascript:alert(1)", "https://stripe.com.evil.example/x"])
      expect(buildTalkTimeline(facts({ quotes: [accepted], payment: { ...link, linkUrl } }), now).cards.map(c => c.kind)).toEqual(["quote"]);
    // Past deadline: no button, a plain notice.
    const late = buildTalkTimeline(facts({ quotes: [accepted], payment: { ...link, linkDeadline: "2026-10-12T02:00:00Z" } }), now).cards[1];
    expect(late.badge.label).toBe("期限切れ"); expect(late.action).toBeUndefined();
  });

  it("shows a processing payment without a button and a confirmed one as done", () => {
    const accepted = quote({ acceptedAt: "2026-10-11T01:00:00Z" });
    const url = "https://buy.stripe.com/test_abc";
    const processing = buildTalkTimeline(facts({ quotes: [accepted], payment: { confirmedAt: null, linkUrl: url, linkDeadline: null, processing: true } }), now).cards[1];
    expect(processing).toMatchObject({ badge: { label: "確認中", tone: "wait" } }); expect(processing.action).toBeUndefined();
    const paid = buildTalkTimeline(facts({ quotes: [accepted], payment: { confirmedAt: "2026-10-12T01:00:00Z", linkUrl: url, linkDeadline: null, processing: false } }), now).cards[1];
    expect(paid).toMatchObject({ badge: { label: "支払い完了", tone: "done" } }); expect(paid.action).toBeUndefined();
  });

  it("offers the delivery button only for a release that is paid, unexpired and openable", () => {
    const paid = { confirmedAt: "2026-10-12T01:00:00Z", linkUrl: null, linkDeadline: null, processing: false };
    const delivery = { exists: true, fileCount: 2, acceptedAt: null as string | null, expiresAt: "2026-11-20T00:00:00Z", openable: true };
    const last = (f: TalkFacts) => buildTalkTimeline(f, now).cards.at(-1)!;
    const waiting = last(facts({ payment: paid, delivery }));
    expect(waiting.action).toEqual({ label: "ダウンロードして受け取る", open: "delivery" });
    expect(waiting.lines.join("")).not.toContain("納品メールにあるリンク");
    const received = last(facts({ payment: paid, delivery: { ...delivery, acceptedAt: "2026-10-12T02:00:00Z" } }));
    expect(received.action).toEqual({ label: "ダウンロードを開く", open: "delivery" });
    for (const change of [{ openable: false }, { expiresAt: "2026-10-01T00:00:00Z" }])
      expect(last(facts({ payment: paid, delivery: { ...delivery, ...change } })).action).toBeUndefined();
    expect(last(facts({ payment: { ...paid, confirmedAt: null }, delivery })).action).toBeUndefined();
    expect(last(facts({ linksAllowed: false, payment: paid, delivery })).action).toBeUndefined();
  });

  it("describes a delivery as waiting, received or expired and never links straight to the files", () => {
    const base = { exists: true, fileCount: 2, acceptedAt: null as string | null, openable: false };
    const waiting = buildTalkTimeline(facts({ delivery: { ...base, expiresAt: "2026-11-20T00:00:00Z" } }), now).cards[0];
    expect(waiting).toMatchObject({ kind: "delivery", badge: { label: "受け取り待ち" } });
    expect(waiting.lines).toContain("ファイル 2点"); expect(waiting.action).toBeUndefined();
    expect(waiting.lines.join("")).toContain("納品メールにあるリンク");
    expect(buildTalkTimeline(facts({ delivery: { ...base, expiresAt: "2026-11-20T00:00:00Z", acceptedAt: "2026-10-12T01:00:00Z" } }), now).cards[0].badge.label).toBe("受け取り済み");
    expect(buildTalkTimeline(facts({ delivery: { ...base, expiresAt: "2026-10-01T00:00:00Z" } }), now).cards[0].badge.label).toBe("期限切れ");
    // A legacy delivery has no file count: the line is simply left out.
    expect(buildTalkTimeline(facts({ delivery: { exists: true, fileCount: null, acceptedAt: null, expiresAt: "2026-11-20T00:00:00Z", openable: false } }), now).cards[0].lines.join("")).not.toContain("ファイル");
  });

  it("tracks the three steps without requiring any order", () => {
    const steps = (f: TalkFacts) => buildTalkTimeline(f, now).steps.map(step => step.done);
    expect(steps(facts())).toEqual([false, false, false]);
    expect(steps(facts({ quotes: [quote({ acceptedAt: "2026-10-11T01:00:00Z" })], payment: { confirmedAt: "2026-10-12T01:00:00Z", linkUrl: null, linkDeadline: null, processing: false } }))).toEqual([true, true, false]);
    expect(steps(facts({ delivery: { exists: true, expiresAt: null, acceptedAt: null, fileCount: 1, openable: true } }))).toEqual([false, false, true]);
  });

  it("validates payment hosts", () => {
    expect(isStripePaymentUrl("https://buy.stripe.com/live_x")).toBe(true);
    expect(isStripePaymentUrl(null)).toBe(false);
    expect(isStripePaymentUrl("not a url")).toBe(false);
  });
});
