// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ConsultationThread from "../ConsultationThread";
import type { ConsultationMessage } from "../../../types/consultation";

const file = { id: "f1", name: "rough.png", sizeBytes: 1024, url: "https://example.test/f1", exists: true as const, acquisitionState: "ready" as const };
const message = (id: string, over: Partial<ConsultationMessage> = {}): ConsultationMessage => ({ id, sender: "staff", body: id, createdAt: "2026-10-11T00:00:00Z", notificationStatus: "sent", files: [], ...over });
let history: ConsultationMessage[];
let posts: { url: string; body: unknown }[];
let closedNow = false;

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("crypto", { subtle: webcrypto.subtle, randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  Element.prototype.scrollIntoView = vi.fn();
  posts = [];
  history = [];
  closedNow = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      const body = JSON.parse(String(init.body)) as { messageId: string };
      history = history.map(item => item.id === body.messageId ? { ...item, rough: { id: "r1", beforeQuote: false, okAt: null } } : item);
      return Response.json({ ok: true });
    }
    return Response.json({ messages: history, closed: closedNow });
  }));
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });
const staff = (closed = false) => render(<ConsultationThread mode="staff" projectId="p1" clientEmail="c@example.test" closed={closed} />);
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); };

describe("marking a rough in the staff thread", () => {
  it("offers the mark only on the staff's own messages that carry files", async () => {
    history = [message("with-file", { files: [file] }), message("plain"), message("from-client", { sender: "client", files: [file] })];
    staff(); await settle();
    expect(screen.getAllByRole("button", { name: "ラフとして提出" })).toHaveLength(1);
  });

  it("posts the mark with the project and message and then shows the rough waiting for the client's OK", async () => {
    history = [message("with-file", { files: [file] })];
    staff(); await settle();
    fireEvent.click(screen.getByRole("button", { name: "ラフとして提出" })); await settle();
    expect(posts).toEqual([{ url: "/api/natori/admin/consultation/rough", body: { projectId: "p1", messageId: "with-file", action: "mark" } }]);
    expect(screen.getByText("ラフ · 依頼者のOK待ち")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ラフの指定を外す" })).toBeTruthy();
    expect(screen.getByText(/ラフとして提出しました/)).toBeTruthy();
  });

  it("shows a recorded OK as final: no un-mark button", async () => {
    history = [message("with-file", { files: [file], rough: { id: "r1", beforeQuote: true, okAt: "2026-10-12T01:00:00Z" } })];
    staff(); await settle();
    expect(screen.getByText(/参考ラフ · 依頼者がOK/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /ラフ/ })).toBeNull();
  });

  it("offers nothing once the talk is closed", async () => {
    history = [message("with-file", { files: [file] })];
    closedNow = true;
    staff(true); await settle();
    expect(screen.queryByRole("button", { name: "ラフとして提出" })).toBeNull();
  });

  it("tells the client which message is a rough, without any mark button", () => {
    render(<ConsultationThread mode="client" token="synthetic" closed={false}
      initialMessages={[message("rough-msg", { files: [file], rough: { id: "r1", beforeQuote: true, okAt: null } })]} />);
    expect(screen.getByText(/参考ラフ（見積もり前） · 上のカード/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ラフとして提出" })).toBeNull();
  });
});
