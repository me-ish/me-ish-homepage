import { describe, expect, it } from "vitest";
import { consultationActivityDay, compareConsultationActivity, consultationNeedsAttention, consultationReplyLabel, consultationReplyState, staffConsultationHref } from "../consultationOverview";
import type { NatoriProject } from "../../types/projects";
const project = (patch: Partial<NatoriProject> = {}): NatoriProject => ({
  id: "a", title: "Synthetic", clientName: "Client", type: "icon", status: "rough", amount: 1000,
  dueDate: null, tasks: [], nextAction: "Continue", createdAt: "2026-01-01T00:00:00Z",
  consultation: { latestMessageId: null, latestMessageAt: null, latestSender: null, notificationFailed: 0, notificationPending: 0 }, ...patch,
});
describe("consultation business read model", () => {
  it("does not equate a fetch failure with no conversations", () => {
    expect(consultationReplyState(project({ consultation: null }))).toBe("unknown");
    expect(consultationNeedsAttention(project({ consultation: null }))).toBe(true);
    expect(consultationReplyState(project())).toBe("none");
    expect(consultationReplyState(project({ status: "inquiry" }))).toBe("new");
  });
  it.each(["rough", "lineart", "coloring", "waiting", "delivery_prep", "delivered", "completed"] as const)("latest sender defines reply wait during %s", status => {
    const p = project({ status });
    p.consultation!.latestSender = "client";
    expect(consultationReplyLabel(p)).toBe("ナトリの返信待ち");
    p.consultation!.latestSender = "staff";
    expect(consultationReplyLabel(p)).toBe("依頼者の返信待ち");
    p.consultation!.notificationFailed = 1;
    expect(consultationReplyState(p)).toBe("client");
    expect(consultationNeedsAttention(p)).toBe(true);
  });
  it("an estimate with no conversation yet needs Natori's action", () => {
    const p = project({ status: "estimating" });
    expect(consultationNeedsAttention(p)).toBe(true);
    expect(consultationReplyLabel(p)).toBe("見積もり作成待ち");
    p.consultation!.latestSender = "staff";
    expect(consultationNeedsAttention(p)).toBe(false);
    expect(consultationReplyLabel(p)).toBe("依頼者の返信待ち");
    expect(consultationNeedsAttention(project({ status: "estimating", deletedAt: "2026-01-01" }))).toBe(false);
    expect(consultationNeedsAttention(project({ status: "quoted" }))).toBe(false);
  });
  it("closed and archived history does not request a new reply", () => {
    const p = project({ status: "closed" }); p.consultation!.latestSender = "client";
    expect(consultationReplyLabel(p)).toBe("相談終了・履歴のみ");
    expect(consultationNeedsAttention(p)).toBe(false);
    p.consultation!.notificationPending = 1;
    expect(consultationNeedsAttention(p)).toBe(true);
    expect(consultationReplyLabel(project({ deletedAt: "2026-01-01" }))).toBe("相談終了・履歴のみ");
  });
  it("sorts actual time across offsets then stabilizes ties by ID", () => {
    const first = project({ id: "b", createdAt: "2026-01-01T08:00:00+09:00" });
    const second = project({ id: "a", createdAt: "2026-01-01T00:00:00Z" });
    expect([second, first].sort(compareConsultationActivity)).toEqual([first, second]);
    expect(compareConsultationActivity(project({ id: "b" }), project({ id: "a" }))).toBeGreaterThan(0);
  });
  it("uses the Japan calendar day for the elapsed-day badge", () => {
    expect(consultationActivityDay(project({ createdAt: "2026-09-26T18:00:00Z" }))).toBe("2026-09-27");
  });
  it("retains existing project URL and selects the shared conversation view", () => {
    expect(staffConsultationHref("a&b")).toBe("/natori/inquiries?project=a%26b&view=conversation");
  });
});
