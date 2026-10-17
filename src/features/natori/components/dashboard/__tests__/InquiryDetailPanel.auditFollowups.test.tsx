// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import InquiryDetailPanel from "../InquiryDetailPanel";
import ConsultationThread from "../../consultation/ConsultationThread";
import { parseInquiryNote } from "../../../lib/inquiryNoteView";
import type { NatoriProject } from "../../../types/projects";
import type { ConsultationMessage } from "../../../types/consultation";

vi.mock("../ProjectActivityTimeline", () => ({ default: () => null }));

const staff: ConsultationMessage = {
  id: "staff-message", sender: "staff", body: "確認をお待ちしています", createdAt: "2026-10-15T01:00:00Z",
  notificationStatus: "sent", files: [],
};
const client: ConsultationMessage = {
  ...staff, id: "client-message", sender: "client", body: "依頼者からの新しい返信", createdAt: "2026-10-15T02:00:00Z",
};
const fixture: NatoriProject = {
  id: "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c", title: "監査用案件", clientName: "架空依頼者", clientEmail: "audit@example.invalid",
  amount: null, dueDate: null, status: "inquiry", nextAction: "確認", type: "undecided", createdAt: "2026-10-01T00:00:00Z",
  deliveryPlan: "normal", tasks: [], referenceImageUrls: [], referenceFiles: [], referenceLinks: [],
  consultation: { latestMessageId: staff.id, latestSender: "staff", latestMessageAt: staff.createdAt,
    notificationFailed: 0, notificationPending: 0, roughOkPending: 0, latestRoughOkId: null, latestRoughOkAt: null },
};
let history: ConsultationMessage[];
let closed: boolean;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  history = [staff]; closed = false;
  sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("crypto", { subtle: webcrypto.subtle, randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  fetchMock = vi.fn(async (url: string) => Response.json(url.includes("probe=1")
    ? { count: history.length, lastId: history.at(-1)?.id ?? null, closed }
    : { messages: history, closed, roughOks: [], roughOkActionsAllowed: true, roughOkSendingEnabled: false }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function panelProps() {
  return { project: fixture, view: parseInquiryNote(undefined), busy: false, initialScreen: "conversation" as const,
    onClose: vi.fn(), onOpenMail: vi.fn(), onCloseInquiry: vi.fn(), onConfirmPayment: vi.fn() };
}
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe("audit U01: conversation and reply-waiting state", () => {
  it("updates the parent projection on a new client reply without a rough OK, without refresh loops", async () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    function Panel() {
      const [project, setProject] = useState(fixture);
      return <InquiryDetailPanel {...panelProps()} project={project} onConversationChanged={() => {
        changed();
        setProject({ ...fixture, consultation: { ...fixture.consultation!, latestMessageId: client.id, latestSender: "client", latestMessageAt: client.createdAt } });
      }} />;
    }
    render(<Panel />); await flush();
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByText("依頼者の返信待ち")).toBeTruthy();
    history = [staff, client];
    await flush(15000);
    expect(screen.getByText(client.body)).toBeTruthy();
    expect(screen.getByText("ナトリの返信待ち")).toBeTruthy();
    expect(screen.queryByText("依頼者の返信待ち")).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
    await flush(15000);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("also reports new messages found by a manual refresh and on focus resume", async () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    render(<ConsultationThread mode="staff" projectId={fixture.id} clientEmail={fixture.clientEmail} onChanged={changed} />); await flush();
    history = [staff, client];
    fireEvent.click(screen.getByRole("button", { name: "履歴を更新" })); await flush();
    expect(changed).toHaveBeenCalledTimes(1);
    await flush(1100);
    history = [...history, { ...client, id: "third-message", body: "追加の返信" }];
    fireEvent(window, new Event("focus")); await flush();
    expect(screen.getByText("追加の返信")).toBeTruthy();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("keeps the parent and drafts unchanged when the changed history cannot be loaded", async () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    render(<ConsultationThread mode="staff" projectId={fixture.id} clientEmail={fixture.clientEmail} onChanged={changed} />); await flush();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "書きかけの返信" } });
    fetchMock.mockImplementation(async (url: string) => url.includes("probe=1")
      ? Response.json({ count: 2, lastId: client.id, closed: false }) : Response.json({}, { status: 503 }));
    await flush(15000);
    expect(changed).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("書きかけの返信");
    expect(screen.getByRole("alert").textContent).toContain("読み込めませんでした");
  });
});

describe("audit U02: unsent drafts", () => {
  it("keeps text and the actual selected File when returning to project details and reopening the conversation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<InquiryDetailPanel {...panelProps()} />);
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "送信前の返信" } });
    fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"), { target: { files: [new File(["synthetic"], "audit.png", { type: "image/png" })] } });
    await screen.findByText(/audit.png/);
    fireEvent.click(screen.getByRole("button", { name: "案件詳細へ戻る" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "相談に返信" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("送信前の返信");
    expect(screen.getByText(/audit.png/)).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it("guards close and Escape, including from the overview, while a draft remains", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const props = panelProps();
    render(<InquiryDetailPanel {...props} />);
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "破棄しない返信" } });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "案件詳細へ戻る" }));
    fireEvent.click(screen.getByRole("button", { name: /^閉じる$/ }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(props.onClose).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /^閉じる$/ }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("asks the browser to protect unsent client drafts on reload, and removes the guard when empty", async () => {
    render(<ConsultationThread mode="client" token="synthetic-audit" initialMessages={[]} closed={false} />);
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "依頼者の書きかけ" } });
    const leave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    const emptyLeave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(emptyLeave);
    expect(emptyLeave.defaultPrevented).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it("does not keep polling a hidden conversation", async () => {
    vi.useFakeTimers();
    render(<InquiryDetailPanel {...panelProps()} />); await flush();
    fireEvent.click(screen.getByRole("button", { name: "案件詳細へ戻る" }));
    fetchMock.mockClear();
    await flush(15000);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent(window, new Event("focus")); await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "相談に返信" })); await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not carry a draft or File across different project actors", async () => {
    const view = render(<ConsultationThread mode="staff" projectId={fixture.id} clientEmail={fixture.clientEmail} />);
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "案件Aの返信" } });
    fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"), { target: { files: [new File(["synthetic"], "private-a.png", { type: "image/png" })] } });
    await screen.findByText(/private-a.png/);
    view.rerender(<ConsultationThread mode="staff" projectId="3ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c" clientEmail={fixture.clientEmail} />);
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText(/private-a.png/)).toBeNull();
  });
});
