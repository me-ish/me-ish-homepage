// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConsultationThread from "../ConsultationThread";
import type { ConsultationMessage } from "../../../types/consultation";
const message = (id: string): ConsultationMessage => ({ id, sender: "staff", body: id, createdAt: "2026-09-26T00:00:00Z", notificationStatus: "sent", files: [] });
const mount = () => render(<ConsultationThread mode="client" token="synthetic" initialMessages={[message("original")]} closed={false} />);
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal("crypto",{subtle:webcrypto.subtle,randomUUID:()=>"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });
describe("consultation history refresh", () => {
  it.each([
    ["failed", "メール通知に失敗 · 相談内容は保存済み"],
    ["pending", "通知未送信・処理中 · 相談内容は保存済み"],
  ])("shows the client's own %s notice separately from its saved message", async (status, label) => {
    const messages: ConsultationMessage[] = [
      { ...message("saved client reply"), sender: "client", notificationStatus: status },
      { ...message("staff reply"), notificationStatus: status },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messages })));
    render(<ConsultationThread mode="client" token="synthetic" initialMessages={messages} closed={false} />);
    await waitFor(() => expect(screen.queryByText("履歴を確認中…")).toBeNull());
    expect(screen.getAllByText(label)).toHaveLength(1);
    expect(screen.getByText("saved client reply")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /再送する/ })).toBeNull();
  });
  it("keeps failed staff notification retry available only to staff", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messages: [{ ...message("saved staff reply"), notificationStatus: "failed" }] })));
    render(<ConsultationThread mode="staff" projectId="synthetic" clientEmail="fixture@example.invalid" />);
    await screen.findByText("saved staff reply");
    expect(screen.getByRole("button", { name: "メール通知に失敗 · 再送する" })).toBeTruthy();
  });
  it("does not label existing staff history as a new arrival on first open", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messages: [message("existing history")] })));
    render(<ConsultationThread mode="staff" projectId="synthetic" clientEmail="fixture@example.invalid" />);
    await screen.findByText("existing history");
    expect(screen.queryByRole("button", { name: "新しいやり取りを見る" })).toBeNull();
  });
  it("keeps displayed history and the draft while refreshing, and never scrolls automatically", async () => {
    let finish!: (response: Response) => void;
    const scroll = vi.fn(); Element.prototype.scrollIntoView = scroll;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    mount();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "draft" } });
    expect(screen.getByText("original")).toBeTruthy();
    await act(async () => { finish(Response.json({ messages: [message("original"), message("new reply")] })); });
    expect(screen.getByText("new reply")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("draft");
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "新しいやり取りを見る" }));
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
  });
  it("shows a saved-send/history-error distinction without offering a blind resend", async () => {
    let reads = 0; const post = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      if (init?.method === "POST") { post(); const raw=JSON.parse(String(init.body)); return Response.json(raw.action==="prepare"?{kind:"prepared",files:[]}:{kind:"committed",messageId:"66666666-7777-4888-8999-aaaaaaaaaaaa",operationId:raw.operation.operationId,requestHash:raw.operation.requestHash}); }
      return ++reads === 1 ? Response.json({ messages: [message("original")] }) : Response.json({}, { status: 503 });
    }));
    mount(); await waitFor(() => expect(screen.queryByText("履歴を確認中…")).toBeNull());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "saved" } });
    fireEvent.click(screen.getByRole("button", { name: "メッセージを送信" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("送信は保存済み"));
    expect(post).toHaveBeenCalledTimes(2);
    expect(screen.getByText("original")).toBeTruthy();
    expect((screen.getByRole("button", { name: "メッセージを送信" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("does not display no replies or enable sending after an initial history failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 503 })));
    render(<ConsultationThread mode="staff" projectId="synthetic" clientEmail="fixture@example.invalid" />);
    await screen.findByRole("alert");
    expect(screen.queryByText(/返信はまだありません/)).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "must wait" } });
    expect((screen.getByRole("button", { name: "メッセージを送信" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
