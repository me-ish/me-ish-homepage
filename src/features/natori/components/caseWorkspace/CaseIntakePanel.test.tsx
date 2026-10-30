// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  load: vi.fn(),
  submit: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock("../../data/supabaseCaseScreen", () => ({ loadCaseContext: m.load }));
vi.mock("../../data/supabaseCaseAdministration", () => ({
  submitCaseAdministration: m.submit,
  loadCaseAdministration: m.receipt,
}));
import { CaseIntakePanel } from "./CaseIntakePanel";
const id = "11111111-1111-4111-8111-111111111111",
  changed = vi.fn(),
  dirty = vi.fn(),
  rejected = vi.fn();
const source = (revision: string, memo = "元のメモ") => ({
  revision,
  project: {
    id,
    status: "inquiry",
    nextAction: memo,
    title: "合成の案件",
    note: "受付時の記録",
    requestData: null,
    deletedAt: null,
  },
  links: [],
  files: [],
  filesState: "ready",
});
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  m.load.mockResolvedValue(source("a".repeat(64)));
});
afterEach(cleanup);
const view = (key: string) => (
  <CaseIntakePanel
    projectId={id}
    section="overview"
    overviewPart="request"
    refreshKey={key}
    onChanged={changed}
    onDraftChange={dirty}
    onAccessRejected={rejected}
  />
);
it("keeps the original revision with a draft and blocks rebasing it onto a later memo", async () => {
  const v = render(view("one"));
  const field = await screen.findByLabelText("次にやること");
  fireEvent.change(field, { target: { value: "編集中の古い入力" } });
  m.load.mockResolvedValue(source("b".repeat(64), "別タブの最新メモ"));
  v.rerender(view("two"));
  await screen.findByText(/保存を止めています/);
  expect(
    (screen.getByLabelText("次にやること") as HTMLInputElement).value,
  ).toBe("編集中の古い入力");
  fireEvent.click(
    screen.getByRole("button", { name: "メモを保存する" }),
  );
  expect(screen.queryByRole("region", { name: "案件操作の確認" })).toBeNull();
  expect(m.submit).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "最新の内容を読み込む" }),
  );
  await waitFor(()=>expect((screen.getByLabelText("次にやること") as HTMLInputElement).value).toBe("別タブの最新メモ"));
  fireEvent.change(screen.getByLabelText("次にやること"), {
    target: { value: "最新版を見た入力" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "メモを保存する" }),
  );
  const saved = JSON.parse(
    sessionStorage.getItem(`natori-case-intake-op/${id}`)!,
  );
  expect(saved.request.revision).toBe("b".repeat(64));
});
it("clears source content on a failed read and never labels an unavailable file list empty", async () => {
  const v = render(view("one"));
  await screen.findByText("受付時の記録");
  m.load.mockRejectedValue(Error("offline"));
  v.rerender(view("two"));
  await screen.findByRole("alert");
  expect(screen.queryByText("受付時の記録")).toBeNull();
  expect(screen.queryByText("まだありません")).toBeNull();
});
it("reopens editing after a saved operation is closed and its newer source is explicitly fetched",async()=>{
 m.submit.mockImplementation(async()=>{m.load.mockResolvedValue(source('b'.repeat(64),'保存したメモ'));return {result:'applied',projectId:id};});
 render(view('one'));await screen.findByLabelText('次にやること');
 fireEvent.change(screen.getByLabelText('次にやること'),{target:{value:'保存したメモ'}});fireEvent.click(screen.getByRole('button',{name:'メモを保存する'}));
 fireEvent.click(screen.getByRole('button',{name:'この内容で保存する'}));await waitFor(()=>expect(screen.getByRole('button',{name:'閉じる'}).hasAttribute('disabled')).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'閉じる'}));await waitFor(()=>expect(screen.getByRole('button',{name:'最新の内容を読み込む'}).hasAttribute('disabled')).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'最新の内容を読み込む'}));
 await waitFor(()=>expect(screen.getByLabelText('次にやること').closest('fieldset')!.disabled).toBe(false));
 expect(screen.queryByText(/保存を止めています/)).toBeNull();
});
it("uses the newest automatic read without waiting for a superseded reset request", async () => {
  const v = render(view("one"));
  await screen.findByLabelText("次にやること");
  fireEvent.change(screen.getByLabelText("次にやること"), {
    target: { value: "捨てる入力" },
  });
  let finishReset!: (value: ReturnType<typeof source>) => void;
  m.load.mockImplementationOnce(() => new Promise(resolve => { finishReset = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "最新の内容を読み込む" }));
  m.load.mockResolvedValue(source("c".repeat(64), "現在表示する保存内容"));
  v.rerender(view("two"));
  await waitFor(() => {
    const field = screen.getByLabelText("次にやること") as HTMLInputElement;
    expect(field.value).toBe("現在表示する保存内容");
    expect(field.closest("fieldset")!.disabled).toBe(false);
  });
  expect(screen.queryByText(/保存を止めています/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "メモを保存する" }));
  expect(JSON.parse(sessionStorage.getItem(`natori-case-intake-op/${id}`)!).request.revision).toBe("c".repeat(64));
  expect(m.submit).not.toHaveBeenCalled();
  // Resolving the old transport later cannot overwrite either the view or draft.
  await act(async () => { finishReset(source("b".repeat(64), "遅れて届く古い応答")); });
  expect((screen.getByLabelText("次にやること") as HTMLInputElement).value).toBe("現在表示する保存内容");
  expect(screen.queryByText(/保存を止めています/)).toBeNull();
});

it("accepts an explicit discard during an automatic read without enabling stale writes", async () => {
  const v=render(view("one"));await screen.findByLabelText("次にやること");
  fireEvent.change(screen.getByLabelText("次にやること"),{target:{value:"破棄する古い入力"}});
  let finishAutomatic!:(value:ReturnType<typeof source>)=>void;
  m.load.mockImplementationOnce(()=>new Promise(resolve=>{finishAutomatic=resolve;}));
  const reset=screen.getByRole("button",{name:"最新の内容を読み込む"}) as HTMLButtonElement;
  fireEvent.pointerDown(reset);
  v.rerender(view("two"));
  await waitFor(()=>expect(screen.getByLabelText("次にやること").closest("fieldset")!.disabled).toBe(true));
  expect(reset.disabled).toBe(false);
  m.load.mockResolvedValue(source("c".repeat(64),"明示的に取得した保存内容"));
  fireEvent.pointerUp(reset);
  fireEvent.click(reset);
  await waitFor(()=>{
    const field=screen.getByLabelText("次にやること") as HTMLInputElement;
    expect(field.value).toBe("明示的に取得した保存内容");expect(field.closest("fieldset")!.disabled).toBe(false);
  });
  await act(async()=>finishAutomatic(source("b".repeat(64),"遅い自動読取")));
  expect((screen.getByLabelText("次にやること") as HTMLInputElement).value).toBe("明示的に取得した保存内容");
  fireEvent.click(screen.getByRole("button",{name:"メモを保存する"}));
  expect(JSON.parse(sessionStorage.getItem(`natori-case-intake-op/${id}`)!).request.revision).toBe("c".repeat(64));
  expect(m.submit).not.toHaveBeenCalled();
});
