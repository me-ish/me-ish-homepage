// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ConsultationAttentionPanel from "../ConsultationAttentionPanel";
import type { NatoriProject } from "../../../types/projects";
const stamp = "2026-10-12T00:00:00Z";
const overview = { latestMessageId: "m", latestMessageAt: stamp, latestSender: "staff" as const, notificationFailed: 0, notificationPending: 0, roughOkPending: 0, latestRoughOkId: null, latestRoughOkAt: null };
const project = (id: string, patch: Partial<NatoriProject> = {}): NatoriProject => ({ id, title: id, clientName: "Client", type: "icon", status: "rough", amount: null, dueDate: null, tasks: [], nextAction: "Review", createdAt: stamp, consultation: overview, ...patch });
afterEach(cleanup);
describe("dashboard shares active rough review policy with inquiry filters", () => {
  it("keeps closed pending/unknown review visible but leaves acknowledged closed mail issues in history", () => {
    render(<ConsultationAttentionPanel projects={[
      project("closedPending", { status: "closed", consultation: { ...overview, roughOkPending: 2, latestRoughOkId: "r", latestRoughOkAt: stamp } }),
      project("closedUnknown", { status: "closed", consultation: null }),
      project("closedAcknowledged", { status: "closed", consultation: { ...overview, notificationPending: 1, notificationFailed: 1 } }),
      project("openMailFailure", { consultation: { ...overview, notificationFailed: 1 } }),
      project("deleted", { deletedAt: stamp, consultation: null }),
    ]} loading={false} onRefresh={vi.fn()} />);
    expect(screen.getByRole("link", { name: /closedPending/ })).toBeTruthy(); expect(screen.getByRole("link", { name: /closedUnknown/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /openMailFailure/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /closedAcknowledged/ })).toBeNull(); expect(screen.queryByRole("link", { name: /deleted/ })).toBeNull();
    expect(screen.getByText("終了案件・ラフOK確認待ち")).toBeTruthy(); expect(screen.getByText("返信状況を取得できません")).toBeTruthy();
    expect(screen.getByRole("link", { name: /要確認の相談をすべて見る/ }).textContent).toContain("3件");
  });
});
