// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TalkStatus from "../TalkStatus";
import ConsultationThread from "../ConsultationThread";
import { buildTalkTimeline } from "../../../lib/talkTimeline";
import type { TalkFacts } from "../../../types/talk";
import type { ConsultationMessage } from "../../../types/consultation";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const facts: TalkFacts = {
  linksAllowed: true, quotes: [], payment: { confirmedAt: null, link: { kind: "absent" } },
  delivery: { exists: false, expiresAt: null, acceptedAt: null, fileCount: null, openable: false },
  roughs: [
    { id: "rough-old", messageId: "message-old", beforeQuote: false, createdAt: "2026-10-15T01:00:00Z", okAt: null },
    { id: "rough-new", messageId: "message-new", beforeQuote: false, createdAt: "2026-10-15T05:00:00Z", okAt: null },
  ],
};
const messages: ConsultationMessage[] = facts.roughs!.map((rough, index) => ({
  id: rough.messageId, sender: "staff", body: `ラフの説明${index + 1}`, createdAt: rough.createdAt, notificationStatus: "sent",
  files: [{ id: `file-${index}`, name: `rough-${index + 1}.png`, sizeBytes: 100, url: `https://files.example.invalid/${index}` }],
  rough: { id: rough.id, beforeQuote: false, okAt: null },
}));

beforeEach(() => {
  sessionStorage.clear(); refresh.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => Response.json(init?.method === "POST" ? { ok: true } : { messages })));
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("audit U03: rough approval identity", () => {
  it("distinguishes same-day submissions and links each card to its actual message and attachment", async () => {
    const timeline = buildTalkTimeline(facts, new Date("2026-10-16T01:00:00Z"));
    render(<><TalkStatus timeline={timeline} token="synthetic-audit" /><ConsultationThread mode="client" token="synthetic-audit" initialMessages={messages} closed={false} /></>);
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false));
    const links = screen.getAllByRole("link", { name: /ラフ[12].*の添付を確認/ });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("aria-label")).toContain("10:00");
    expect(links[1].getAttribute("aria-label")).toContain("14:00");
    for (const [index, link] of links.entries()) {
      const targetId = decodeURIComponent(link.getAttribute("href")!.slice(1));
      const target = document.getElementById(targetId)!;
      expect(within(target).getByText(messages[index].body)).toBeTruthy();
      expect(within(target).getByRole("link", { name: new RegExp(`rough-${index + 1}\\.png`) })).toBeTruthy();
      expect(target.tabIndex).toBe(-1);
    }
  });

  it("names the selected submission in confirmation and posts the matching rough ID", async () => {
    const timeline = buildTalkTimeline(facts, new Date("2026-10-16T01:00:00Z"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TalkStatus timeline={timeline} token="synthetic-audit" />);
    const second = screen.getAllByRole("button", { name: "このラフでOK" })[1];
    fireEvent.click(second);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(confirm.mock.calls[0][0]).toContain("ラフ2");
    expect(confirm.mock.calls[0][0]).toContain("14:00");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ roughId: "rough-new" });
  });

  it("keeps answered submissions identifiable and provides no links or approval actions for terminal projects", () => {
    const timeline = buildTalkTimeline({ ...facts, linksAllowed: false,
      roughs: facts.roughs!.map(rough => ({ ...rough, okAt: "2026-10-16T00:00:00Z" })) }, new Date("2026-10-16T01:00:00Z"));
    render(<TalkStatus timeline={timeline} token="synthetic-audit" />);
    expect(screen.getByText(/ラフ1 ·/)).toBeTruthy();
    expect(screen.getByText(/ラフ2 ·/)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
