// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import NotificationVerification from "../NotificationVerification";
import { VERIFICATION_PURPOSES } from "@/features/natori/types/notificationVerification";
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("the gated mail verification screen", () => {
  it("never sends automatically and shares the real status display", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); render(<NotificationVerification />);
    expect(screen.getByRole("heading", { name: "承諾・受取のメール通知" })).toBeTruthy();
    expect(screen.getAllByText("送信待ち")).toHaveLength(3); expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends the bounded campaign only on click, with CSRF and no customer input", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: VERIFICATION_PURPOSES.map(purpose => ({ purpose, status: "sent", acceptedAt: "2026-09-27T10:00:00Z" })) }) });
    vi.stubGlobal("fetch", fetcher); render(<NotificationVerification />);
    fireEvent.click(screen.getByRole("button", { name: "確認メール3通を送る" }));
    await waitFor(() => expect(screen.getAllByText("送信サービス受付済み")).toHaveLength(3));
    expect(fetcher.mock.calls[0]).toEqual(["/api/natori/admin/notification-verification", { method: "POST", headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" }, body: '{"purpose":"all"}' }]);
    expect(screen.getByRole("status").textContent).toContain("受信箱");
  });
  it("shows a request failure without claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false })); render(<NotificationVerification />);
    fireEvent.click(screen.getByRole("button", { name: "確認メール3通を送る" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("送信結果を確認できませんでした"));
    expect(screen.queryByText("送信サービス受付済み")).toBeNull();
  });
  it("retains known success when a repeated request becomes uncertain", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ results: VERIFICATION_PURPOSES.map(purpose => ({ purpose, status: "sent", acceptedAt: "2026-09-27T10:00:00Z" })) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: VERIFICATION_PURPOSES.map(purpose => ({ purpose, status: "unknown", acceptedAt: null })) }) });
    vi.stubGlobal("fetch", fetcher); render(<NotificationVerification />);
    fireEvent.click(screen.getByRole("button", { name: "確認メール3通を送る" }));
    await waitFor(() => expect(screen.getAllByText("送信サービス受付済み")).toHaveLength(3));
    fireEvent.click(screen.getByRole("button", { name: "確認メール3通を送る" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("受付を確認できない"));
    expect(screen.getAllByText("送信サービス受付済み")).toHaveLength(3);
  });
});
