// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConsultationThread from "../ConsultationThread";
import type { ConsultationMessage, StaffRoughOk } from "../../../types/consultation";
const pid = "11111111-2222-4333-8444-555555555555", mid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", rid = "99999999-bbbb-4ccc-8ddd-eeeeeeeeeeee", newerId = "77777777-bbbb-4ccc-8ddd-eeeeeeeeeeee", nid = "88888888-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const stamp = "2026-10-12T00:00:00Z";
const row = (id = rid): StaffRoughOk => ({ id, messageId: mid, beforeQuote: true, okAt: stamp, acknowledgedAt: null, notificationId: nid,
  notificationStatus: "unknown", notificationAttemptNo: 1, notificationSentAt: null, retryAvailable: true, reviewRequired: false });
const message: ConsultationMessage = { id: mid, sender: "staff", body: "Original rough", createdAt: stamp, notificationStatus: "sent", files: [], rough: { id: rid, beforeQuote: true, okAt: stamp } };
let rows: unknown, closed: boolean, actionsAllowed: boolean, sending: boolean, posts: { projectId: string; roughId: string; action: string }[], response: unknown;
let onPost: (() => Promise<void>) | undefined;
const changed = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); rows = [row()]; closed = false; actionsAllowed = true; sending = true; posts = []; response = { ok: true, roughId: rid }; onPost = undefined;
  vi.stubGlobal("crypto", { subtle: webcrypto.subtle, randomUUID: () => mid }); Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      expect(url).toBe("/api/natori/admin/consultation/rough-ok"); expect(init.headers).toMatchObject({ "x-requested-with": "me-ish" });
      const body = JSON.parse(String(init.body)) as typeof posts[number]; posts.push(body); if (onPost) await onPost();
      if (response && typeof response === "object" && "ok" in response && response.ok === true && "roughId" in response && response.roughId === body.roughId && body.action === "acknowledge") {
        rows = (rows as StaffRoughOk[]).map(item => item.id === body.roughId ? { ...item, acknowledgedAt: stamp } : item);
      }
      return Response.json(response);
    }
    return Response.json({ messages: [message], roughOks: rows, closed, roughOkActionsAllowed: actionsAllowed, roughOkSendingEnabled: sending });
  }));
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const mount = (clientEmail?: string) => render(<ConsultationThread mode="staff" projectId={pid} clientEmail={clientEmail} onChanged={changed} />);
const loaded = () => waitFor(() => expect(screen.queryByText("履歴を確認中…")).toBeNull());
const confirm = async () => { fireEvent.click(screen.getByRole("button", { name: "このラフの次の対応を確認" })); fireEvent.click(screen.getByRole("button", { name: "このラフOKを確認済みにする" })); await loaded(); };

describe("staff rough acknowledgement integration", () => {
  it("refreshes parent and same thread after ack while preserving unsent body and chosen files", async () => {
    mount("client@example.invalid"); await loaded(); const box = screen.getByRole("textbox"); fireEvent.change(box, { target: { value: "Draft survives acknowledgement" } });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["fixture"], "unsent.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText(/unsent\.png/)).toBeTruthy()); await confirm();
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1)); expect(posts).toEqual([{ projectId: pid, roughId: rid, action: "acknowledge" }]);
    expect((box as HTMLTextAreaElement).value).toBe("Draft survives acknowledgement"); expect(screen.getByText(/unsent\.png/)).toBeTruthy();
    expect(screen.getByText(/次の対応は確認済み/)).toBeTruthy(); expect(screen.queryByRole("button", { name: "このラフの次の対応を確認" })).toBeNull();
    expect(screen.getByRole("button", { name: "このラフOKのメールだけ再試行" })).toBeTruthy();
  });
  it("acknowledges without client email or sending configuration and allows closed evidence review", async () => {
    closed = true; sending = false; mount(); await loaded(); expect(screen.getByText("終了案件・ラフOK確認待ち")).toBeTruthy();
    await confirm(); await waitFor(() => expect(changed).toHaveBeenCalledTimes(1)); expect(screen.queryByRole("textbox")).toBeNull();
    expect((screen.getByRole("button", { name: "このラフOKのメールだけ再試行" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("a newer concurrent OK remains pending after the selected rough is acknowledged", async () => {
    onPost = async () => { rows = [...rows as StaffRoughOk[], row(newerId)]; };
    mount(); await loaded(); await confirm(); await waitFor(() => expect(screen.getByText(/次の対応は確認済み/)).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "このラフの次の対応を確認" })).toHaveLength(1);
    expect(screen.getByText("ラフOK・次の対応待ち")).toBeTruthy(); expect(posts[0].roughId).toBe(rid);
  });
  it.each([null, {}, { ok: true }, { ok: true, roughId: newerId }, { ok: false, roughId: rid }])("malformed acknowledgement result cannot clear attention %#", async receipt => {
    response = receipt; mount(); await loaded(); await confirm();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("操作結果を確認できません"));
    expect(changed).not.toHaveBeenCalled(); expect(screen.getByText("ラフOK・次の対応待ち")).toBeTruthy();
  });
  it.each([undefined, null, [{ ...row(), okAt: "bad" }], [row(), row()]])("unavailable/malformed list is explicit and exposes no business actions %#", async unsafeRows => {
    rows = unsafeRows; mount(); await loaded(); expect(screen.getByRole("alert").textContent).toContain("確認状況を取得できません");
    expect(screen.queryByRole("button", { name: "このラフの次の対応を確認" })).toBeNull();
  });
  it("does not turn notification retry into an acknowledgement", async () => {
    mount(); await loaded(); fireEvent.click(screen.getByRole("button", { name: "このラフOKのメールだけ再試行" }));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1)); expect(posts[0].action).toBe("retry-notification"); expect(screen.getByText("ラフOK・次の対応待ち")).toBeTruthy();
  });
  it("tombstone history exposes no actions even when its OK is still unacknowledged", async () => {
    closed = true; actionsAllowed = false; mount(); await loaded(); expect(screen.getByText("終了案件・ラフOK確認待ち")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "このラフの次の対応を確認" })).toBeNull(); expect(screen.queryByRole("button", { name: /メールだけ/ })).toBeNull();
  });
  it("polls an acknowledgement from another tab without any new message, preserving the draft", async () => {
    vi.useFakeTimers();
    const base = fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => url.includes("probe=1")
      ? Response.json({ count: 1, lastId: mid, closed: false, roughs: `${rid}+`, roughOks: (rows as StaffRoughOk[]).map(item => `${item.id}/${item.acknowledgedAt ?? "pending"}`).join(",") }) : base(url, init)));
    mount("client@example.invalid"); await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const box = screen.getByRole("textbox"); fireEvent.change(box, { target: { value: "Preserved during background ack" } });
    rows = [{ ...row(), acknowledgedAt: stamp }]; await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(screen.getByText(/次の対応は確認済み/)).toBeTruthy(); expect((box as HTMLTextAreaElement).value).toBe("Preserved during background ack");
    expect(changed).toHaveBeenCalledTimes(1); expect(posts).toEqual([]);
  });
  it("an acknowledgement response from the previous actor cannot refresh or change the current composer", async () => {
    let release: () => void = () => undefined;
    onPost = () => new Promise<void>(resolve => { release = resolve; });
    const view = mount("client@example.invalid"); await loaded();
    fireEvent.click(screen.getByRole("button", { name: "このラフの次の対応を確認" })); fireEvent.click(screen.getByRole("button", { name: "このラフOKを確認済みにする" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    view.rerender(<ConsultationThread mode="staff" projectId={newerId} clientEmail="client@example.invalid" onChanged={changed} />); await loaded();
    const box = screen.getByRole("textbox"); fireEvent.change(box, { target: { value: "New project draft" } });
    await act(async () => release());
    expect(changed).not.toHaveBeenCalled(); expect((box as HTMLTextAreaElement).value).toBe("New project draft");
  });
});
