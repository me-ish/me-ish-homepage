// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ConsultationThread from "../ConsultationThread";
import type { ConsultationMessage } from "../../../types/consultation";

const message = (id: string, createdAt: string): ConsultationMessage => ({ id, sender: "client", body: id, createdAt, notificationStatus: "sent", files: [] });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("管理画面のトークに挟む出来事の行", () => {
  it("見積もりを送った時刻に合う位置へ、メッセージの合間に一行で出す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messages: [message("前のメッセージ", "2026-10-31T12:04:00Z"), message("あとのメッセージ", "2026-10-31T12:30:00Z")] })));
    render(<ConsultationThread mode="staff" projectId="synthetic" clientEmail="fixture@example.invalid" events={[{ at: "2026-10-31T12:12:00Z", text: "見積もりを送りました" }]} />);
    await screen.findByText("あとのメッセージ");
    const items = screen.getAllByRole("listitem").map(item => item.textContent ?? "");
    const order = ["前のメッセージ", "見積もりを送りました", "あとのメッセージ"].map(text => items.findIndex(item => item.includes(text)));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("メッセージが無くても、見積もりを送った行だけは出す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messages: [] })));
    render(<ConsultationThread mode="staff" projectId="synthetic" clientEmail="fixture@example.invalid" events={[{ at: "2026-10-31T12:12:00Z", text: "見積もりを送りました" }]} />);
    await waitFor(() => expect(screen.getByText(/見積もりを送りました/)).toBeTruthy());
  });
});
