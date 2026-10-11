// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ConsultationThread from "../ConsultationThread";
import type { ConsultationMessage } from "../../../types/consultation";

const message = (id: string, sender: "staff" | "client" = "staff"): ConsultationMessage => ({ id, sender, body: id, createdAt: "2026-09-26T00:00:00Z", notificationStatus: "sent", files: [] });
const mount = () => render(<ConsultationThread mode="client" token="synthetic" initialMessages={[message("original")]} closed={false} />);
const tick = async (ms = 15000) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

let calls: string[];
let probe: { count: number; lastId: string | null; closed: boolean };
let history: ConsultationMessage[];

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  vi.stubGlobal("crypto", { subtle: webcrypto.subtle, randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  calls = [];
  history = [message("original")];
  probe = { count: 1, lastId: "original", closed: false };
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return url.includes("probe=1") ? Response.json(probe) : Response.json({ messages: history });
  }));
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("consultation auto refresh", () => {
  it("asks the light probe on a timer and does not reload while nothing changed", async () => {
    mount(); await tick(0);
    calls.length = 0;
    await tick();
    expect(calls).toEqual(["/api/natori/consult/synthetic?probe=1"]);
  });

  it("reloads the history and follows the newest message when a new one arrives and the reader is at the bottom", async () => {
    mount(); await tick(0);
    history = [message("original"), message("new reply")];
    probe = { count: 2, lastId: "new reply", closed: false };
    await tick();
    expect(screen.getByText("new reply")).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(screen.queryByRole("button", { name: "新しいやり取りを見る" })).toBeNull();
  });

  it("keeps the reader in place and offers the jump button when they are reading above the latest message", async () => {
    mount(); await tick(0);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ bottom: 5000, top: 4900, left: 0, right: 0, width: 0, height: 100, x: 0, y: 4900, toJSON: () => ({}) });
    (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    history = [message("original"), message("new reply")];
    probe = { count: 2, lastId: "new reply", closed: false };
    await tick();
    expect(screen.getByText("new reply")).toBeTruthy();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "新しいやり取りを見る" })).toBeTruthy();
  });

  it("stays silent when the probe fails and never shows a history error for it", async () => {
    mount(); await tick(0);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 503 })));
    await tick();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not poll while the tab is hidden", async () => {
    mount(); await tick(0);
    calls.length = 0;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await tick();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    expect(calls).toEqual([]);
  });
});
