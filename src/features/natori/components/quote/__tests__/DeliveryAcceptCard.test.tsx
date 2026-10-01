// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeliveryAcceptCard from "../DeliveryAcceptCard";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const base = { token: "synthetic", title: "Synthetic delivery", clientName: "Fixture", acceptedAt: null };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("delivery acceptance safety", () => {
  it("shows missing members and disables acceptance for a partial manifest", () => {
    render(<DeliveryAcceptCard {...base} canAccept={false} files={[
      { id: "1", fileName: "ready.png", sizeBytes: 20, url: "https://example.invalid/ready" },
      { id: "2", fileName: "missing.psd", sizeBytes: 20, url: null },
    ]} />);
    expect(screen.getByText("missing.psd")).toBeTruthy();
    expect((screen.getByRole("button", { name: "内容を確認し、受け取りを完了する" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "ファイルと受取状況を更新" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("does not turn a server-side file rejection into acceptance", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "delivery_files_unavailable" }, { status: 409 })));
    render(<DeliveryAcceptCard {...base} canAccept files={[{ fileName: "final.png", sizeBytes: 20, url: "https://example.invalid/file" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "内容を確認し、受け取りを完了する" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("alert"));
  });
  it("keeps accepted evidence on a revisit even when files are unavailable", async () => {
    render(<DeliveryAcceptCard {...base} acceptedAt="2026-09-27T01:00:00Z" canAccept={false}
      files={[{ fileName: "missing.png", sizeBytes: 20, url: null }]} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("status")));
    expect(screen.queryByRole("button", { name: "内容を確認し、受け取りを完了する" })).toBeNull();
    expect(screen.getByText("missing.png")).toBeTruthy();
  });
});
