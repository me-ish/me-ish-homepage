// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RoughOkFollowups from "../RoughOkFollowups";
import type { StaffRoughOk } from "../../../types/consultation";
const stamp = "2026-10-12T00:00:00Z";
const row = (id = "r1", patch: Partial<StaffRoughOk> = {}): StaffRoughOk => ({ id, messageId: `m-${id}`, beforeQuote: false, okAt: stamp, acknowledgedAt: null,
  notificationId: "notice", notificationStatus: "failed", notificationAttemptNo: 1, notificationSentAt: null, retryAvailable: true, reviewRequired: false, ...patch });
const messages = [{ id: "m-r1", sender: "staff" as const, body: "First drawing", files: [{ id: "f", name: "first.png", sizeBytes: 4, url: null }], notificationStatus: "sent", createdAt: stamp },
  { id: "m-r2", sender: "staff" as const, body: "Second drawing", files: [{ id: "f2", name: "second.png", sizeBytes: 4, url: null }], notificationStatus: "sent", createdAt: stamp }];
afterEach(cleanup);
describe("rough OK per-item owner review", () => {
  it("makes same-minute roughs identifiable and requires explicit confirmation for only that item", () => {
    const action = vi.fn(async () => undefined); render(<RoughOkFollowups rows={[row(), row("r2")]} messages={messages} closed={false} actionsAllowed busy={false} sendingEnabled onAction={action} />);
    expect(screen.getByText("first.png")).toBeTruthy(); expect(screen.getByText("second.png")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "このラフの提出内容を見る" }).map(link => link.getAttribute("href"))).toEqual(["#consultation-message-m-r1", "#consultation-message-m-r2"]);
    fireEvent.click(screen.getAllByRole("button", { name: "このラフの次の対応を確認" })[1]); expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "このラフOKを確認済みにする" })); expect(action).toHaveBeenCalledWith("r2", "acknowledge");
  });
  it("offers evidence-only acknowledgement on closed history and keeps mail retry separate after ack", () => {
    const action = vi.fn(async () => undefined); render(<RoughOkFollowups rows={[row(), row("r2", { acknowledgedAt: stamp })]} messages={messages} closed actionsAllowed busy={false} sendingEnabled onAction={action} />);
    expect(screen.getByText("終了案件・ラフOK確認待ち")).toBeTruthy(); expect(screen.getByText(/相談の終了状態は変わりません/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "このラフの次の対応を確認" })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: "このラフOKのメールだけ再試行" })[1]); expect(action).toHaveBeenCalledWith("r2", "retry-notification");
  });
  it("allows business acknowledgement while mail is paused, and hides actions on tombstones", () => {
    const action = vi.fn(async () => undefined);
    const view = render(<RoughOkFollowups rows={[row()]} messages={messages} closed={false} actionsAllowed busy={false} sendingEnabled={false} onAction={action} />);
    expect(screen.getByText("通知送信を一時停止しています。")).toBeTruthy();
    expect((screen.getByRole("button", { name: "このラフOKのメールだけ再試行" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "このラフの次の対応を確認" }) as HTMLButtonElement).disabled).toBe(false);
    view.rerender(<RoughOkFollowups rows={[row()]} messages={messages} closed actionsAllowed={false} busy={false} sendingEnabled onAction={action} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("shows unavailable and legacy evidence honestly, without an automatic retry", () => {
    const action = vi.fn(async () => undefined); const view = render(<RoughOkFollowups rows={null} messages={messages} closed={false} actionsAllowed busy={false} sendingEnabled onAction={action} />);
    expect(screen.getByRole("alert").textContent).toContain("取得できません");
    view.rerender(<RoughOkFollowups rows={[row("r1", { notificationId: null, notificationStatus: null, notificationAttemptNo: null, retryAvailable: false })]} messages={messages} closed={false} actionsAllowed busy={false} sendingEnabled onAction={action} />);
    expect(screen.getByText(/導入前のOK記録/)).toBeTruthy(); expect(screen.queryByRole("button", { name: /メールだけ/ })).toBeNull(); expect(action).not.toHaveBeenCalled();
  });
});
