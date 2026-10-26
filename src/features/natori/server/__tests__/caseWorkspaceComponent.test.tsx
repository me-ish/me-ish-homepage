// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
// This suite verifies the outer reader/navigation; command panels have separate integration coverage.
vi.mock("../../components/caseWorkspace/CaseWorkPanel",()=>({CaseWorkPanel:()=>null}));
vi.mock("../requireNatoriAdmin", () => ({ resolveNatoriOperator: () => { throw new Error("Unexpected live auth"); } }));
vi.mock("../trustedNatoriOwner", () => ({ resolveTrustedNatoriOwnerId: () => { throw new Error("Unexpected live owner lookup"); } }));
import { buildPreviewRecords } from "../../../../../scripts/natori-case-preview/fixtureReader";
import { CaseWorkspacePreview, type CasePreviewLoader } from "../../components/caseWorkspace/CaseWorkspacePreview";
import { CaseWorkspaceSections } from "../../components/caseWorkspace/CaseWorkspaceSections";
import { deriveCaseReadModel } from "../../lib/caseReadModel";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";
import { CaseWorkspaceLoadError } from "../../types/caseWorkspaceLoad";
import * as entryData from "../../data/supabaseCaseEntries";

let records: CaseWorkspaceRecord[];
beforeAll(async () => { records = await buildPreviewRecords(); });
beforeEach(() => { window.history.replaceState(null, "", "/"); vi.spyOn(window,"scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const caseHeading = () => screen.getByRole("heading", { name: "森の表紙イラスト" });
const otherNav = () => within(screen.getByRole("navigation", { name: "案件のほかの画面" }));
const stepList = () => within(screen.getByRole("region", { name: "案件の段階" }));

it("searches the complete collection beyond page one and retains the selected page",async()=>{
 const many=Array.from({length:121},(_,n)=>({...records[0],id:`extra-${n}`,title:`架空大量案件${String(n).padStart(3,"0")}`}));
 render(<CaseWorkspacePreview load={async()=>many} initialSearch="?entry=cases&page=3"/>);
 const target=await screen.findByRole("link",{name:/架空大量案件120/});fireEvent.click(target);
 expect(screen.getByRole("heading",{name:"架空大量案件120"})).toBeTruthy();
 fireEvent.click(screen.getByRole("link",{name:"← 案件へ戻る"}));expect(window.location.search).toContain("page=3");
 fireEvent.change(screen.getByRole("searchbox"),{target:{value:"案件010"}});
 expect(window.location.search).not.toContain("page=3");expect(screen.getByRole("link",{name:/架空大量案件010/})).toBeTruthy();
});

it("immediately clears every cached view on an index 401 even if another read never finishes",async()=>{
 vi.spyOn(entryData,"loadCasePersonalEvents").mockResolvedValue([{id:"event",title:"合成個人予定",date:"2026-11-12"}]);
 const notices=vi.spyOn(entryData,"loadCaseNoticeIndex").mockResolvedValue({revision:"a".repeat(32),items:[]});
 const load=vi.fn<CasePreviewLoader>().mockResolvedValueOnce(records).mockImplementation(()=>new Promise(()=>{}));
 render(<CaseWorkspacePreview application entryTools load={load} initialSearch={`?case=${records[0].id}`}/>);
 await screen.findByRole("heading",{name:records[0].title});
 notices.mockRejectedValue(new CaseWorkspaceLoadError("unauthorized"));
 fireEvent(window,new Event("focus"));
 await waitFor(()=>expect(screen.queryByRole("heading",{name:records[0].title})).toBeNull());
 expect(screen.getByRole("alert").textContent).toContain("表示を消去しました");
});

it("protects a personal event draft from being silently moved to another day",async()=>{
 vi.spyOn(entryData,"loadCasePersonalEvents").mockResolvedValue([{id:"event",title:"月末の個人予定",date:"2026-11-30"}]);
 vi.spyOn(entryData,"loadCaseNoticeIndex").mockResolvedValue({revision:"a".repeat(32),items:[]});
 const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 render(<CaseWorkspacePreview application entryTools load={async()=>records} initialSearch="?entry=schedule&date=2026-11-30&month=2026-12"/>);
 fireEvent.click(await screen.findByRole("button",{name:"予定「月末の個人予定」を編集"}));
 fireEvent.change(screen.getByRole("textbox",{name:"タイトル"}),{target:{value:"保存前の予定"}});
 fireEvent.click(screen.getByRole("button",{name:/2026-12-01 登録納期/}));
 expect(confirm).toHaveBeenCalledTimes(1);expect((screen.getByLabelText("予定日") as HTMLInputElement).value).toBe("2026-11-30");
 expect((screen.getByRole("textbox",{name:"タイトル"}) as HTMLInputElement).value).toBe("保存前の予定");
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole("button",{name:/2026-12-01 登録納期/}));
 expect((screen.getByLabelText("予定日") as HTMLInputElement).value).toBe("2026-12-01");
 expect(screen.queryByRole("textbox",{name:"タイトル"})).toBeNull();
});

it("retries a failed auxiliary index without treating it as an empty notification list",async()=>{
 vi.spyOn(entryData,"loadCasePersonalEvents").mockResolvedValue([]);
 const notices=vi.spyOn(entryData,"loadCaseNoticeIndex").mockRejectedValueOnce(new CaseWorkspaceLoadError("unavailable")).mockResolvedValue({revision:"a".repeat(32),items:[]});
 render(<CaseWorkspacePreview application entryTools load={async()=>records} initialSearch="?entry=notifications"/>);
 const retry=await screen.findByRole("button",{name:"予定・通知を再取得"});
 expect(screen.queryByText("この条件の通知系列はありません。")).toBeNull();
 fireEvent.click(retry);await waitFor(()=>expect(notices).toHaveBeenCalledTimes(2));
 await screen.findByText("この条件の通知系列はありません。");expect(screen.queryByRole("button",{name:"予定・通知を再取得"})).toBeNull();
});

it("does not keep retrying personal events that are outside the dedicated acceptance profile",async()=>{
 const events=vi.spyOn(entryData,"loadCasePersonalEvents").mockResolvedValue([]);
 vi.spyOn(entryData,"loadCaseNoticeIndex").mockResolvedValue({revision:"a".repeat(32),items:[]});
 render(<CaseWorkspacePreview application entryTools personalEventsEnabled={false} load={async()=>records} initialSearch="?entry=schedule"/>);
 await screen.findByText("この検証設定では個人予定は対象外です。");await waitFor(()=>expect(screen.getByRole("status").textContent).toBe("表示を取得しました"));
 expect(events).not.toHaveBeenCalled();expect(screen.queryByRole("button",{name:"予定・通知を再取得"})).toBeNull();
});

it.each(["today","cases","schedule","notifications"])("shows unavailable quote facts and their transaction review consistently through %s",async entry=>{
  const original=records[0],snapshotId=original.model.snapshotId;
  const model=deriveCaseReadModel({...original.model.facts,projectId:original.id,snapshotId,asOf:original.model.checkedAt,
    quote:{state:"unavailable",reason:"incomplete"}});
  const record={...original,model};
  window.history.replaceState(null,"",`/?entry=${entry}&case=${record.id}&section=overview&date=${record.registeredDueDate}`);
  render(<CaseWorkspacePreview readOnly load={async()=>[record]}/>);
  await screen.findByRole("heading",{name:record.title});
  const guidance=within(screen.getByRole("region",{name:"案件の共通案内"}));
  expect(guidance.getByText("いまの段階：見積の状態が分かりません")).toBeTruthy();
  expect(guidance.getByText("あなた：見積の状態を読み込めませんでした。見積・支払いを開いて確認")).toBeTruthy();
  expect(guidance.queryByText("相談中")).toBeNull();
  expect(guidance.queryByText("見積OK・支払い前")).toBeNull();
  expect(guidance.queryByText(/お客さん：.*支払/)).toBeNull();
  expect(screen.queryByRole("button",{name:/送信|再送|発行/})).toBeNull();
  fireEvent.click(guidance.getByRole("link",{name:"見積・支払いを開く"}));
  expect(window.location.search).toContain("section=transaction");
});

it.each(["today","cases","schedule","notifications"])("shows unconfirmed payment sharing consistently through %s without changing commands",async entry=>{
  const original=records[6],snapshotId=original.model.snapshotId;
  const model=deriveCaseReadModel({...original.model.facts,projectId:original.id,snapshotId,asOf:original.model.checkedAt,
    notifications:{state:"ready",snapshotId,observedAt:original.model.checkedAt,revision:"no-notice",value:[]}});
  const record={...original,model};
  window.history.replaceState(null,"",`/?entry=${entry}&case=${record.id}&section=transaction&date=${record.registeredDueDate}`);
  render(<CaseWorkspacePreview load={async()=>[record]}/>);
  await screen.findByRole("heading",{name:record.title});
  const guidance=within(screen.getByRole("region",{name:"案件の共通案内"}));
  expect(guidance.getByText("あなた：支払いリンクのメールが届いたか確認")).toBeTruthy();
  expect(guidance.queryByText(/お客さん：お支払い待ち/)).toBeNull();
  expect(screen.queryByRole("button",{name:/送信|再送|発行/})).toBeNull();
  expect(model.actions.find(a=>a.id==="prepare_payment_notice")?.blockedBy).toContain("link_already_exists");
});

it("returns from an exact notification to its original filter and selection without sending",async()=>{
  const record=records[7],notice=record.model.facts.notifications;
  if(notice.state!=="ready"||!notice.value.length)throw Error("notification fixture required");
  window.history.replaceState(null,"","/?entry=notifications&q=光&filter=staff&month=2026-11");
  render(<CaseWorkspacePreview load={async()=>records}/>);
  const item=await screen.findByRole("link",{name:/納品案内.*受付結果は未確認/});fireEvent.click(item);
  expect(window.location.search).toContain(`notice=${notice.value[0].id}`);expect(window.location.search).toContain("section=production");
  expect(screen.getByRole("complementary",{name:"選択した通知"}).textContent).toContain(notice.value[0].target.revision);
  fireEvent.click(screen.getByRole("link",{name:"← 通知へ戻る"}));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("光");
  expect((screen.getByLabelText("対応で絞り込む") as HTMLSelectElement).value).toBe("staff");
  expect(document.activeElement?.id).toBe(`notice-${notice.value[0].id}`);
  expect(screen.queryByRole("button",{name:/送信|再送|発行/})).toBeNull();
});

it("keeps separate entry searches, calendar month/date and selection while navigating",async()=>{
  render(<CaseWorkspacePreview load={async()=>records}/>);await screen.findByRole("link",{name:/森の表紙イラスト/});
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"森"}});
  const nav=within(screen.getByRole("navigation",{name:"主な入口"}));
  fireEvent.click(nav.getByRole("link",{name:"予定"}));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("表示月"),{target:{value:"2026-11"}});
  fireEvent.click(screen.getByRole("button",{name:/2026-11-12 登録納期1件/}));
  fireEvent.click(screen.getByRole("link",{name:/森の表紙イラスト/}));
  fireEvent.click(screen.getByRole("link",{name:"← 2026-11-12の予定へ戻る"}));
  expect((screen.getByLabelText("表示月") as HTMLInputElement).value).toBe("2026-11");
  expect((screen.getByLabelText("予定日") as HTMLInputElement).value).toBe("2026-11-12");
  fireEvent.click(nav.getByRole("link",{name:"今日"}));expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("森");
  fireEvent.click(nav.getByRole("link",{name:"予定"}));expect((screen.getByLabelText("表示月") as HTMLInputElement).value).toBe("2026-11");
});

it.each(["主な入口","スマホの主な入口"])("keeps current filters and selection when returning through the same %s",async label=>{
  render(<CaseWorkspacePreview load={async()=>records}/>);await screen.findByRole("link",{name:/森の表紙イラスト/});
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"森"}});fireEvent.change(screen.getByLabelText("対応で絞り込む"),{target:{value:"staff"}});
  fireEvent.click(screen.getByRole("link",{name:/森の表紙イラスト/}));
  fireEvent.click(within(screen.getByRole("navigation",{name:label})).getByRole("link",{name:"今日"}));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("森");
  expect((screen.getByLabelText("対応で絞り込む") as HTMLSelectElement).value).toBe("staff");
  expect(document.activeElement?.id).toBe(`case-${records[0].id}`);
});

it("keeps evidence readable while the pause view omits every command panel",async()=>{
  render(<CaseWorkspacePreview load={async()=>records} application readOnly initialSearch={`?case=${records[0].id}&section=transaction`}/>);
  await screen.findByRole("heading",{name:"森の表紙イラスト"});
  expect(screen.getByText("操作を停止しています。確定した記録と未確認の処理を読み取れます。")).toBeTruthy();
  expect(screen.getByText("照会のみの画面です。送信・発行・外部照合・解決の保存は停止しています。")).toBeTruthy();
  expect(screen.queryByRole("button",{name:/送信|発行|照合|保存/})).toBeNull();
  expect(screen.getByRole("region",{name:"案件の共通案内"}).textContent).toContain("見積OK・支払い前");
});

it("does not report zero calendar counts before a read or after it fails",async()=>{
  window.history.replaceState(null,"","/?entry=schedule&month=2026-11");
  let fail!:(reason:Error)=>void;
  render(<CaseWorkspacePreview load={()=>new Promise((_resolve,reject)=>{fail=reject;})}/>);
  expect(screen.getByRole("button",{name:"2026-11-12 登録納期件数未確認"})).toBeTruthy();
  expect(screen.getByText("件数未確認",{exact:true})).toBeTruthy();
  await act(async()=>fail(new Error("synthetic read failure")));
  expect(screen.getByRole("button",{name:"2026-11-12 登録納期件数未確認"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"2026-11-12 登録納期0件"})).toBeNull();
  expect(screen.queryByText("0案件",{exact:true})).toBeNull();
});

it("opens one common case from the list and keeps filters and focus on returning", async () => {
  render(<CaseWorkspacePreview load={async () => records} />);
  await screen.findByRole("link", { name: /依頼者A.*森の表紙イラスト/ });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "森" } });
  fireEvent.change(screen.getByLabelText("対応で絞り込む"), { target: { value: "staff" } });
  fireEvent.click(screen.getByRole("link", { name: /依頼者A.*森の表紙イラスト/ }));
  expect(caseHeading()).toBe(document.activeElement);
  expect(window.location.search).toContain("section=transaction");
  expect(stepList().getByRole("link", { name: /^支払い/ }).getAttribute("aria-current")).toBe("step");
  fireEvent.click(stepList().getByRole("link", { name: /^制作/ }));
  expect(window.location.search).toContain("section=production");
  expect(screen.getByRole("heading", { name: "制作・納品" })).toBe(document.activeElement);
  for (const label of ["相談", "履歴", "その他"]) fireEvent.click(otherNav().getByRole("link", { name: label }));
  expect(caseHeading()).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "← 今日へ戻る" }));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("森");
  expect((screen.getByLabelText("対応で絞り込む") as HTMLSelectElement).value).toBe("staff");
  expect(document.activeElement?.id).toBe(`case-${records[0].id}`);
  const search=screen.getByRole("searchbox");
  search.focus();
  fireEvent.change(search,{target:{value:"森の"}});
  expect(document.activeElement).toBe(search);
  fireEvent.change(search,{target:{value:"森の表"}});
  expect(document.activeElement).toBe(search);
});

it("restores a deep link after data arrives and responds to browser history state", async () => {
  window.history.replaceState(null, "", `/?entry=schedule&case=${records[0].id}&section=history&date=2026-11-12`);
  let resolve!: (value: readonly CaseWorkspaceRecord[]) => void;
  render(<CaseWorkspacePreview load={() => new Promise(done => { resolve = done; })} />);
  await act(async () => { resolve(records); });
  expect(caseHeading()).toBe(document.activeElement);
  expect(otherNav().getByRole("link", { name: "履歴" }).getAttribute("aria-current")).toBe("page");
  act(() => { window.history.replaceState(null, "", "/?entry=cases&q=雲"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("雲");
  expect(screen.queryByRole("heading", { name: "森の表紙イラスト" })).toBeNull();
});

it("retains known facts after refresh failure and recovers through the actual loader", async () => {
  window.history.replaceState(null, "", `/?case=${records[0].id}`);
  const load = vi.fn<CasePreviewLoader>(async mode => { if (mode === "failed") throw new Error("Synthetic failure"); return records; });
  render(<CaseWorkspacePreview load={load} />);
  await screen.findByRole("heading", { name: "森の表紙イラスト" });
  fireEvent.change(screen.getByLabelText("架空データの取得状態"), { target: { value: "failed" } });
  expect((await screen.findByRole("alert")).textContent).toContain("前回確認した記録");
  expect(caseHeading()).toBeTruthy();
  expect(screen.getByText("前回確認した段階：見積OK・支払い前")).toBeTruthy();
  expect(screen.getByText(`前回確認：${records.length}案件`,{exact:true})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "表示を再取得" }));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
  fireEvent.change(screen.getByLabelText("架空データの取得状態"), { target: { value: "normal" } });
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

it("distinguishes an initial failed read from an empty case list", async () => {
  render(<CaseWorkspacePreview load={async () => { throw new Error("Synthetic failure"); }} />);
  expect((await screen.findByRole("alert")).textContent).toContain("まだ取得できていません");
  expect(screen.queryByText("この表示条件に合う案件はありません。")).toBeNull();
});

it("ignores a superseded read even when a loader does not honor abort", async () => {
  const pending: { signal: AbortSignal; resolve: (value: readonly CaseWorkspaceRecord[]) => void }[] = [];
  const load: CasePreviewLoader = (_mode, signal) => new Promise(resolve => pending.push({ signal, resolve }));
  render(<CaseWorkspacePreview load={load} />);
  fireEvent.change(screen.getByLabelText("架空データの取得状態"), { target: { value: "partial" } });
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => { pending[1].resolve([records[2]]); });
  await screen.findByRole("link", { name: /雲のアイコン/ });
  await act(async () => { pending[0].resolve([records[0]]); });
  expect(screen.queryByRole("link", { name: /森の表紙イラスト/ })).toBeNull();
});

it("presents unmatched acceptance consistently in overview and history", () => {
  const record = records[0], quote = record.model.facts.quote;
  if (quote.state !== "ready" || !quote.value.acceptance) throw new Error("Accepted fixture required");
  const mismatched = { ...record, model: deriveCaseReadModel({ ...record.model.facts,
    projectId: record.id, snapshotId: record.model.snapshotId, asOf: record.model.checkedAt,
    quote: { ...quote, value: { ...quote.value, acceptance: { ...quote.value.acceptance, version: 99 } } },
  }) };
  const view = render(<CaseWorkspaceSections record={mismatched} section="overview" />);
  expect(screen.getByText(/でOK（要確認：見積との対応が未確認）/)).toBeTruthy();
  view.rerender(<CaseWorkspaceSections record={mismatched} section="history" />);
  expect(screen.getByText("OKの記録（要確認：見積との対応が未確認）")).toBeTruthy();
  expect(document.querySelector("form")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

it.each(["unauthorized","scope_unavailable"] as const)("clears every previously displayed fact on %s and hides fixture controls in the application",async kind=>{
  const load=vi.fn<CasePreviewLoader>().mockResolvedValueOnce(records).mockRejectedValueOnce(new CaseWorkspaceLoadError(kind));
  render(<CaseWorkspacePreview load={load} application initialSearch={`?case=${records[0].id}&section=history`} today="2026-10-21" basePath="/natori/dashboard/cases" />);
  await screen.findByRole("heading",{name:"森の表紙イラスト"});
  expect(screen.queryByLabelText("架空データの取得状態")).toBeNull();
  expect(stepList().getByRole("link",{name:/^見積/}).getAttribute("href")).toMatch(/^\/natori\/dashboard\/cases\?/);
  fireEvent(window,new Event("focus"));
  expect((await screen.findByRole("alert")).textContent).toContain("案件の表示を消去");
  expect(screen.queryByRole("heading",{name:"森の表紙イラスト"})).toBeNull();
  expect(screen.queryByText("￥40,000")).toBeNull();
});

it("acceptance personal events never enable the unrelated case-registration form",async()=>{
 const target={profile:"local",ref:"local",project:"local-fixture",url:"http://localhost:4193",origin:"http://localhost:4195",run:"44444444-4444-4444-8444-444444444444",startsAt:"2026-01-01T00:00:00Z",endsAt:"2099-01-01T00:00:00Z"};
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",target.url);vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET",JSON.stringify(target));
 try{
  vi.spyOn(entryData,"loadCasePersonalEvents").mockResolvedValue([]);
  vi.spyOn(entryData,"loadCaseNoticeIndex").mockResolvedValue({revision:"a".repeat(32),items:[]});
  render(<CaseWorkspacePreview application entryTools personalEventsEnabled load={async()=>records} initialSearch="?entry=cases"/>);
  await waitFor(()=>expect(screen.getByRole("status").textContent).toBe("表示を取得しました"));
  expect(screen.queryByRole("region",{name:"新しい案件の登録"})).toBeNull();
 }finally{vi.unstubAllEnvs();}
});

it.each(["主な入口","スマホの主な入口"])("opens the public pages from the %s and returns to the same entry",async label=>{
  render(<CaseWorkspacePreview load={async()=>records} initialSearch="?entry=cases"/>);await screen.findByRole("link",{name:/森の表紙イラスト/});
  fireEvent.click(within(screen.getByRole("navigation",{name:label})).getByRole("link",{name:"ページ"}));
  expect(window.location.search).toContain("utility=pages");
  const pages=within(screen.getByRole("region",{name:"公開ページ"}));
  expect(pages.getAllByRole("link",{name:"編集する"}).map(a=>a.getAttribute("href"))).toEqual(["/natori/portfolio/edit","/natori/links/edit"]);
  expect(pages.getAllByRole("link",{name:/見る/}).map(a=>[a.getAttribute("href"),a.getAttribute("target")])).toEqual([["/natori/portfolio","_blank"],["/natori/links","_blank"]]);
  expect(pages.getByRole("link",{name:/実績/}).getAttribute("href")).toBe("/natori/results");
  expect(within(screen.getByRole("navigation",{name:label})).getByRole("link",{name:"ページ"}).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(screen.getByRole("navigation",{name:label})).getByRole("link",{name:"案件"}));
  expect(window.location.search).not.toContain("utility=pages");
  expect(screen.queryByRole("region",{name:"公開ページ"})).toBeNull();
});
