import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../requireNatoriAdmin", () => ({ resolveNatoriOperator: () => { throw new Error("Unexpected live auth"); } }));
vi.mock("../trustedNatoriOwner", () => ({ resolveTrustedNatoriOwnerId: () => { throw new Error("Unexpected live owner lookup"); } }));
import { buildPreviewRecords, previewEnvelopes } from "../../../../../scripts/natori-case-preview/fixtureReader";
import { deriveCaseReadModel } from "../../lib/caseReadModel";
import { caseKnown, deriveCaseGuidance, observationLabel } from "../../lib/caseWorkspacePresentation";
import { caseWorkspaceHref, parseCaseWorkspaceLocation } from "../../lib/caseWorkspaceNavigation";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";
import {caseMonthDays,matchesCaseEntry} from "../../lib/caseWorkspaceEntries";

let normal: CaseWorkspaceRecord[], partial: CaseWorkspaceRecord[];
beforeAll(async () => { normal = await buildPreviewRecords(); partial = await buildPreviewRecords("partial"); });

export function mismatchedAgreement(record: CaseWorkspaceRecord): CaseWorkspaceRecord {
  const quote = record.model.facts.quote;
  if (quote.state !== "ready" || !quote.value.acceptance) throw new Error("Accepted fixture required");
  return { ...record, model: deriveCaseReadModel({ ...record.model.facts,
    projectId: record.id, snapshotId: record.model.snapshotId, asOf: record.model.checkedAt,
    quote: { ...quote, value: { ...quote.value, acceptance: { ...quote.value.acceptance, version: 99 } } },
  }) };
}

describe("synthetic reader to case workspace", () => {
  it.each(["incomplete", "read_failed", "unsupported", "not_requested"] as const)("keeps %s quote evidence visibly unknown and points to its records", reason => {
    const record = normal[0], quote = reason === "not_requested" ? { state: "not_requested" as const }
      : { state: "unavailable" as const, reason };
    const model = deriveCaseReadModel({ ...record.model.facts, quote,
      projectId: record.id, snapshotId: record.model.snapshotId, asOf: record.model.checkedAt });
    const guidance = deriveCaseGuidance({ ...record, model });
    expect(model.agreement).toBe("unknown");
    expect(guidance.status).toBe("見積の状態が分かりません");
    expect(guidance.primary.section).toBe("transaction");
    expect(guidance.facts).toContainEqual({ label: "決まった金額", value: "分かりません" });
    expect(guidance.waits.some(wait => wait.who === "client")).toBe(false);
    expect(model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
  });
  it("does not label fully read quote absence as an unavailable quote", () => {
    const record = normal[0], quote = { state: "absent" as const, snapshotId: record.model.snapshotId,
      observedAt: record.model.checkedAt, revision: "absent" };
    const model = deriveCaseReadModel({ ...record.model.facts, quote,
      projectId: record.id, snapshotId: record.model.snapshotId, asOf: record.model.checkedAt });
    const guidance = deriveCaseGuidance({ ...record, model });
    expect(guidance.status).toBe("相談中");
    expect(guidance.waits.some(wait => wait.key === "quote-unconfirmed")).toBe(false);
  });
  it("retains paid, receipt and inactive facts ahead of unavailable quote navigation", () => {
    for (const [index, expected] of [[2, "制作中"], [3, "受取済み"]] as const) {
      const record = normal[index], model = deriveCaseReadModel({ ...record.model.facts,
        quote: { state: "unavailable", reason: "incomplete" },
        projectId: record.id, snapshotId: record.model.snapshotId, asOf: record.model.checkedAt });
      const guidance = deriveCaseGuidance({ ...record, model });
      expect(guidance.status).toBe(expected);
      expect(guidance.waits.some(wait => wait.key === "quote-unconfirmed")).toBe(false);
    }
    const record = normal[0];
    for (const rawStatus of ["closed", "completed"] as const) {
      if (record.display.project.state !== "ready") throw Error("Expected fixture project");
      const model = deriveCaseReadModel({ ...record.model.facts, quote: { state: "unavailable", reason: "incomplete" },
        projectId: record.id, snapshotId: record.model.snapshotId, asOf: record.model.checkedAt });
      const display = { ...record.display, project: { ...record.display.project,
        value: { ...record.display.project.value, rawStatus } } };
      const guidance = deriveCaseGuidance({ ...record, model, display });
      expect(guidance.status).toBe(rawStatus === "closed" ? "終了" : "完了");
      expect(guidance.waits.some(wait => wait.key === "quote-unconfirmed")).toBe(false);
    }
  });
  it("uses the authorized reader for eight cases without relaxing command prerequisites for unknown origins", () => {
    expect(normal).toHaveLength(8);
    for (const record of normal) {
      expect(caseKnown(record.display.project)?.origin).toBe("unknown");
      expect(record.model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
    }
    expect(caseKnown(normal[2].display.project)?.rawStatus).toBe("rough");
    expect(caseKnown(normal[2].display.tasks)?.filter(task => task.done)).toHaveLength(1);
    expect(caseKnown(normal[2].display.conversation)?.latestSender).toBe("client");
  });
  it("preserves project payment evidence and legacy receipt when related reads fail, without inventing delivery identity", () => {
    expect(caseKnown(partial[2].display.payment)).toMatchObject({ money: { amount: 40000 }, correspondence: "unconfirmed" });
    expect(caseKnown(partial[3].display.receipt)).toMatchObject({ deliveryId: null, correspondence: "unconfirmed" });
    expect(deriveCaseGuidance(partial[3]).status).toBe("受取済み");
    expect(deriveCaseGuidance(partial[2]).unknown).toContain("入金：読み込めませんでした");
    expect(partial[0].display.payment.state).toBe("unavailable");
    expect(partial[0].display.conversation.state).toBe("unavailable");
    expect(observationLabel(partial[0].display.payment)).not.toContain("記録なし");
  });
  it("labels a list that was read but is empty with the caller's empty text", () => {
    const empty = { state: "ready", snapshotId: "s", observedAt: "2026-10-27T00:00:00Z", revision: "r", value: [] } as const;
    expect(observationLabel(empty, "まだメールは送っていません")).toBe("まだメールは送っていません");
  });
  it("keeps matched receipt and unknown delivery notification as separate facts", () => {
    const record = normal[7], guidance = deriveCaseGuidance(record);
    expect(record.model.stage).toBe("received");
    expect(guidance.status).toBe("受取済み");
    expect(guidance.waits).toContainEqual(expect.objectContaining({ who: "staff", section: "production", text: "メールが届いたか確認" }));
    expect(guidance.waits.some(wait => wait.text === "納品の受け取り待ち")).toBe(false);
  });
  it("does not turn task completion or raw completed status into receipt", async () => {
    const data = previewEnvelopes();
    data[2].project.status = "completed";
    const records = await buildPreviewRecords("normal", data);
    expect(caseKnown(records[2].display.receipt)).toBeUndefined();
    expect(deriveCaseGuidance(records[2]).status).toBe("完了");
  });
  it("does not regress legacy receipt or known payment to client prerequisite waits", async () => {
    const data = previewEnvelopes();
    data[3].project.status = "delivered";
    data[4].project.payment_confirmed_at = "2026-10-19T03:00:00Z";
    data[4].project.paid_amount = 40000;
    const records = await buildPreviewRecords("partial", data);
    expect(deriveCaseGuidance(records[3]).status).toBe("受取済み");
    expect(deriveCaseGuidance(records[3]).waits.some(wait => wait.text === "納品の受け取り待ち")).toBe(false);
    expect(deriveCaseGuidance(records[4]).status).toBe("制作中");
    expect(deriveCaseGuidance(records[4]).waits.some(wait => wait.text === "見積を確認中")).toBe(false);
    expect(deriveCaseGuidance(records[3]).unknown.some(text => text.includes("どの納品に対するものかを確認できていません"))).toBe(true);
  });
  it("leads an accepted quote with no link to transaction, and a matched current link to client payment waiting", () => {
    expect(deriveCaseGuidance(normal[0]).primary.section).toBe("transaction");
    expect(deriveCaseGuidance(normal[6]).waits).toContainEqual(expect.objectContaining({ who: "client", text: "お支払い待ち" }));
  });
  it("shows the link record and unconfirmed notice without asserting absence or client waiting",async()=>{
    const data=previewEnvelopes();data[6].sections.financial_notifications={total:0,rows:[]};
    const [,,,,,,record]=await buildPreviewRecords("normal",data),g=deriveCaseGuidance(record);
    expect(g.waits).toContainEqual(expect.objectContaining({who:"staff",text:"支払いリンクのメールが届いたか確認",section:"transaction"}));
    expect(g.waits.some(w=>w.who==="client")).toBe(false);expect(g.primary.section).toBe("transaction");
    expect(g.status).toBe("見積OK・支払い前");expect(caseKnown(record.model.facts.link)?.state).toBe("active");
    expect(g.waits.some(w=>w.text.includes("未送信"))).toBe(false);
    expect(record.model.actions.filter(a=>a.execution!=="read_only").every(a=>!a.available)).toBe(true);
  });
  it.each(["sent","state_error","failed"])("keeps legacy %s evidence tied to its actual link/terms",async status=>{
    const data=previewEnvelopes(),e=data[6];
    const a=(e.sections.financial_links as {rows:Record<string,unknown>[]}).rows[0];
    a.deadline="2026-10-26T02:00:00Z";e.sections.financial_notifications={total:0,rows:[]};
    e.sections.financial_legacy_notices={total:1,rows:[{id:"legacy-payment",project_id:e.project.id,quote_id:a.quote_id,
      attempt_id:a.id,kind:"payment",amount:40000,status,sent_at:status==="failed"?null:"2026-10-19T02:00:00Z",
      created_at:"2026-10-19T01:00:00Z",updated_at:"2026-10-19T02:00:00Z"}]};
    const record=(await buildPreviewRecords("normal",data))[6],g=deriveCaseGuidance(record);
    expect(g.waits.some(w=>w.who==="client"&&w.text==="お支払い待ち")).toBe(status!=="failed");
    if(status==="state_error")expect(g.waits).toContainEqual(expect.objectContaining({who:"staff",text:"メールの送信結果を確認"}));
    if(status==="failed")expect(g.waits).toContainEqual(expect.objectContaining({who:"staff",text:"支払いリンクのメールが届いたか確認"}));
  });
  it("suppresses new payment checks for known project payment/receipt despite incomplete correlated reads",async()=>{
    const data=previewEnvelopes();data[6].sections.financial_notifications={total:0,rows:[]};
    const record=(await buildPreviewRecords("normal",data))[6],fact={state:"ready" as const,snapshotId:record.model.snapshotId,observedAt:record.model.checkedAt,revision:"synthetic-fallback"};
    for(const display of [
      {...record.display,payment:{...fact,value:{confirmedAt:"2026-10-19T03:00:00Z",money:{amount:40000,currency:"JPY"},method:"project_projection" as const,correspondence:"unconfirmed" as const}}},
      {...record.display,receipt:{...fact,value:{acceptedAt:"2026-10-19T03:00:00Z",deliveryId:null,correspondence:"unconfirmed" as const}}},
    ]){
      const g=deriveCaseGuidance({...record,display});
      expect(g.waits.some(w=>w.text==="支払いリンクのメールが届いたか確認"||w.text==="お支払い待ち")).toBe(false);
      expect(["制作中","受取済み"]).toContain(g.status);
    }
  });
  it("keeps expired quote and absent current notice as staff checks from the common model", async () => {
    const data = previewEnvelopes();
    const quoteRows = data[4].sections.financial_quotes as { rows: Record<string, unknown>[] };
    quoteRows.rows[0].expires_at = "2026-10-19T04:00:00Z";
    data[4].sections.financial_notifications = { total: 0, rows: [] };
    const records = await buildPreviewRecords("normal", data);
    const guidance = deriveCaseGuidance(records[4]);
    expect(records[4].model.attention.some(item => item.reason === "quote_expired")).toBe(true);
    expect(guidance.waits).toContainEqual(expect.objectContaining({ who: "staff", text: "見積の期限が切れました。出し直すか決める" }));
    expect(guidance.waits).toContainEqual(expect.objectContaining({ who: "staff", text: "最新の条件のメールが届いたか確認" }));
    expect(guidance.waits.some(wait => wait.who === "client")).toBe(false);
  });
  it("keeps the paid-link stop check ahead of production navigation", async () => {
    const data = previewEnvelopes();
    data[6].project.payment_confirmed_at = "2026-10-19T03:00:00Z";
    data[6].project.paid_amount = 40000;
    const records = await buildPreviewRecords("normal", data);
    expect(deriveCaseGuidance(records[6]).waits[0]).toMatchObject({ who: "staff", section: "transaction", text: "入金済みの支払いリンクが止まったか確認" });
  });
  it("labels unmatched acceptance evidence without asserting agreed amount", () => {
    const record = mismatchedAgreement(normal[0]), before = structuredClone(record);
    expect(record.model.agreement).toBe("needs_review");
    const guidance = deriveCaseGuidance(record);
    expect(guidance.status).not.toBe("見積OK・支払い前");
    expect(guidance.facts).toContainEqual({ label: "OKをもらった金額（要確認）", value: "￥40,000" });
    expect(guidance.facts.some(fact => fact.label === "決まった金額")).toBe(false);
    expect(guidance.waits[0].who).toBe("staff");
    expect(record).toEqual(before);
  });
});

describe("local case URLs", () => {
  it("includes an accepted quote without any notification in the notification entry, even after manual progress",async()=>{
    const data=previewEnvelopes();data[0].project.status="awaiting_payment";
    const record=(await buildPreviewRecords("normal",data))[0],nav=parseCaseWorkspaceLocation("?entry=notifications");
    expect(matchesCaseEntry(record,nav)).toBe(true);
    const guidance=deriveCaseGuidance(record);
    expect(guidance.status).toBe("見積OK・支払い前");expect(guidance.waits[0]).toMatchObject({who:"staff",section:"transaction"});
    expect(guidance.waits.some(w=>w.who==="client"&&w.text.includes("支払"))).toBe(false);
  });
  it("does not call an accepted quote unpaid when payment facts could not be read",async()=>{
    const record=(await buildPreviewRecords("normal",previewEnvelopes()))[0];
    expect(deriveCaseGuidance(record).status).toBe("見積OK・支払い前");
    const model={...record.model,facts:{...record.model.facts,payment:{state:"unavailable" as const,reason:"read_failed" as const}}};
    expect(deriveCaseGuidance({...record,model}).status).toBe("見積OK・入金は確認できません");
  });
  it("round-trips month and exact notification selection without accepting a return URL",()=>{
    const nav=parseCaseWorkspaceLocation("?entry=notifications&notice=legacy-mail%3A123&month=2026-12&date=2026-11-12&selected=old-case&q=森&return=https://evil.invalid");
    expect(parseCaseWorkspaceLocation(caseWorkspaceHref(nav).slice(1))).toEqual(nav);
    expect(nav).toMatchObject({entry:"notifications",month:"2026-12",noticeId:"legacy-mail:123"});
    expect(caseWorkspaceHref(nav)).not.toContain("evil");
    expect(parseCaseWorkspaceLocation("?month=2026-13&notice=https://evil.invalid")).toMatchObject({month:"2026-10",noticeId:null});
  });
  it("builds actual calendar days and preserves query/owner wait filters",()=>{
    expect(caseMonthDays("2028-02")).toHaveLength(29);expect(caseMonthDays("2026-02")).toHaveLength(28);expect(caseMonthDays("2026-13")).toEqual([]);
    const nav=parseCaseWorkspaceLocation("?entry=schedule&date=2026-11-12&q=森&filter=staff");
    expect(matchesCaseEntry(normal[0],nav)).toBe(true);expect(matchesCaseEntry(normal[1],nav)).toBe(false);
    expect(matchesCaseEntry(normal[0],{...nav,date:"2026-11-13"})).toBe(false);
  });
  it("round-trips case, section, entry, filters and selected date", () => {
    const state = { ...parseCaseWorkspaceLocation(""), entry: "schedule" as const, projectId: normal[0].id,
      selectedId: normal[0].id, section: "transaction" as const, query: "森 & A", filter: "staff" as const, date: "2026-11-12" };
    const href = caseWorkspaceHref(state);
    expect(href.startsWith("/?")).toBe(true);
    expect(parseCaseWorkspaceLocation(href.slice(1))).toEqual(state);
  });
  it("rejects unknown routes, invalid calendar dates and arbitrary return destinations", () => {
    expect(parseCaseWorkspaceLocation("?entry=admin&case=https://evil.invalid&section=send&date=2026-02-30&return=https://evil.invalid"))
      .toMatchObject({ entry: "cases", projectId: null, section: "overview", date: "2026-10-20" });
    expect(caseWorkspaceHref(parseCaseWorkspaceLocation("?return=https://evil.invalid"))).not.toContain("evil");
  });
});
