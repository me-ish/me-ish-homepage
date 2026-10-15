// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import NotificationAlertBanner from "../NotificationAlertBanner";
import { publishNotificationAttention } from "../notificationSummaryStore";
import { notificationPurposeName, NOTIFICATION_PURPOSE_NAMES } from "../../../lib/notificationLabels";
import { summarizeNotificationAttention } from "../../../lib/notificationSummary";
import type { NatoriNotificationList, NatoriNotificationSummary } from "../../../types/notifications";

afterEach(() => {
  cleanup();
  act(() => publishNotificationAttention(null));
});

const item = (status: string, reviewRequired = false): NatoriNotificationSummary => ({
  id: `n-${status}-${reviewRequired}`, projectId: "p", projectTitle: "t", purpose: "quote_accepted_artist",
  status, attemptNo: 1, lastSentAt: null, retryAvailable: false, reviewRequired,
});
const list = (notifications: NatoriNotificationSummary[], enabled = true): NatoriNotificationList =>
  ({ enabled, sendingEnabled: true, notifications, truncated: false, offset: 0 });

describe("通知の名前", () => {
  it("全ての用途に読める名前があり、未知の用途は「通知」になる", () => {
    expect(Object.keys(NOTIFICATION_PURPOSE_NAMES)).toHaveLength(16);
    for (const name of Object.values(NOTIFICATION_PURPOSE_NAMES)) expect(name.length).toBeGreaterThan(0);
    expect(notificationPurposeName("unknown_purpose")).toBe("通知");
  });
});

describe("summarizeNotificationAttention", () => {
  it("sent 以外を数え、確認が必要なものを別に数える", () => {
    expect(summarizeNotificationAttention(list([item("sent"), item("failed"), item("unknown", true)])))
      .toEqual({ unresolved: 2, reviewRequired: 1 });
  });
  it("無効・未取得なら null", () => {
    expect(summarizeNotificationAttention(null)).toBeNull();
    expect(summarizeNotificationAttention(list([item("failed")], false))).toBeNull();
  });
});

describe("NotificationAlertBanner", () => {
  it("0 件・未取得では何も出さない", () => {
    const { container } = render(<NotificationAlertBanner />);
    expect(container.innerHTML).toBe("");
    act(() => publishNotificationAttention({ unresolved: 0, reviewRequired: 0 }));
    expect(container.innerHTML).toBe("");
  });
  it("件数と要確認の内訳、通知パネルへのリンクを出す", () => {
    render(<NotificationAlertBanner />);
    act(() => publishNotificationAttention({ unresolved: 3, reviewRequired: 1 }));
    expect(screen.getByRole("status").textContent).toContain("3 件");
    expect(screen.getByRole("status").textContent).toContain("確認が必要 1 件");
    expect(screen.getByRole("link", { name: "通知の一覧を見る" }).getAttribute("href")).toBe("#notification-heading");
  });
  it("要確認が 0 なら内訳を出さない", () => {
    render(<NotificationAlertBanner />);
    act(() => publishNotificationAttention({ unresolved: 2, reviewRequired: 0 }));
    expect(screen.getByRole("status").textContent).not.toContain("確認が必要");
  });
});
