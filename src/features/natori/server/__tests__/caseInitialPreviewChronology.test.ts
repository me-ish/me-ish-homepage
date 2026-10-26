import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../requireNatoriAdmin", () => ({ resolveNatoriOperator: () => { throw Error("No live Auth in reproduction"); } }));
vi.mock("../trustedNatoriOwner", () => ({ resolveTrustedNatoriOwnerId: () => { throw Error("No live owner lookup in reproduction"); } }));
import { readCaseManagement } from "../caseManagementReader";
import { CASE_MANAGEMENT_SECTIONS } from "../caseManagementQuery";
import { natoriManagementScope } from "../natoriManagementScope";
import { deriveCaseGuidance } from "../../lib/caseWorkspacePresentation";
import { fixtureRows } from "../../../../../scripts/natori-case-initial-preview/setup.mjs";
import { plan } from "../../../../../scripts/natori-case-initial-preview/plan.mjs";

// Only the dedicated acceptance DB's synthetic project/quote scalars are used.
// All other sections are empty synthetic controls; no Auth/profile data or HTTP.
const projectId = "e1627560-76b7-4f7a-9641-88610fa66f96";
const ownerId = "16018e8a-f04a-4dd3-a95c-a0a0354af590";
const quoteId = "aa139da7-3f08-40c3-8af6-c34557485bb2";
const issued = "2026-10-23T23:30:00+00:00";
const quoteCreated = "2026-10-24T02:22:50.910864+00:00";
const projectUpdated = "2026-10-24T02:22:52.306408+00:00";

function fixture(coherentControl = false, title = "架空案件・見積承諾済み／支払案内未送信") {
  const acceptedAt = coherentControl ? projectUpdated : issued;
  return {
    snapshot_id: "synthetic-preview-chronology",
    observed_at: "2026-10-24T13:55:27.315797+00:00",
    project: {
      id: projectId, user_id: ownerId, title, client_name: "検証専用の架空依頼者",
      status: "quoted", type: "illustration", amount: 12000, due_date: "2026-11-12",
      active_quote_id: quoteId, quote_accepted_at: acceptedAt, quote_accepted_amount: 12000,
      payment_confirmed_at: null, paid_amount: null, paid_at: null,
      delivery_accepted_at: null, completed_at: null, delivered_mail_at: null,
      has_legacy_payment_link: false, payment_link_status: null, deleted_at: null,
      created_at: "2026-10-24T02:22:50.314355+00:00", updated_at: projectUpdated,
    },
    sections: {
      ...Object.fromEntries(CASE_MANAGEMENT_SECTIONS.map(name => [name, { total: 0, rows: [] }])),
      financial_quotes: { total: 1, rows: [{
        id: quoteId, project_id: projectId, user_id: ownerId, version: 1, amount: 12000,
        expires_at: "2026-10-25T00:00:00+00:00", superseded_at: null,
        created_at: quoteCreated, issued_at: coherentControl ? quoteCreated : issued,
        accepted_at: acceptedAt,
      }] },
    },
  };
}

async function read(row: ReturnType<typeof fixture>) {
  const before = JSON.stringify(row);
  const result = await natoriManagementScope.run({ ownerId, operator: { kind: "auth-user", userId: ownerId } },
    () => readCaseManagement(projectId, async statement => {
      expect(statement.values).toEqual([projectId, ownerId]);
      return { rows: [row] };
    }));
  expect(JSON.stringify(row)).toBe(before);
  if (result.state !== "ready") throw Error("Expected readable synthetic envelope");
  const guidance = deriveCaseGuidance({
    id: projectId, title: result.metadata.title!, clientLabel: result.metadata.clientLabel!,
    registeredDueDate: result.metadata.registeredDueDate, model: result.model, display: result.display,
  });
  return { result, guidance };
}

describe("initial hosted preview chronology investigation", () => {
  it("keeps the malformed source unknown and directs review to transaction without claiming an earlier stage", async () => {
    const { result, guidance } = await read(fixture());
    expect(result.model.facts.quote).toEqual({ state: "unavailable", reason: "incomplete" });
    expect(result.model.agreement).toBe("unknown");
    expect(result.model.stage).toBe("unknown");
    expect(guidance.status).toBe("見積の状態は未確認");
    expect(guidance.facts).toEqual(expect.arrayContaining([
      { label: "内部見積", value: "一部の記録を確認できません" },
      { label: "合意した金額", value: "未確認" },
      { label: "入金", value: "記録なし（取得済み）" },
    ]));
    expect(guidance.waits).toEqual([{ key: "quote-unconfirmed", who: "staff", text: "見積の状態は未確認です。取引の記録を確認してください", section: "transaction" }]);
    expect(guidance.primary).toEqual({ label: "取引の記録へ", section: "transaction" });
    expect(guidance.unknown).toContain("内部見積：一部の記録を確認できません");
    expect(result.model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
  });

  it("does not use the case title or raw quoted status as proof of acceptance", async () => {
    const { result, guidance } = await read(fixture(false, "任意の案件名"));
    expect(result.model.agreement).toBe("unknown");
    expect(guidance.status).toBe("見積の状態は未確認");
    expect(guidance.facts).toContainEqual({ label: "合意した金額", value: "未確認" });
  });

  it("shows acceptance and staff payment-notice work when only the local control's three time fields are coherent", async () => {
    const { result, guidance } = await read(fixture(true));
    expect(result.model.facts.quote).toMatchObject({ state: "ready", value: {
      id: quoteId, version: 1, acceptance: { quoteId, version: 1, money: { amount: 12000, currency: "JPY" } },
    } });
    expect(result.model.agreement).toBe("accepted");
    expect(guidance.status).toBe("見積承諾済み");
    expect(guidance.facts).toContainEqual({ label: "合意した金額", value: "￥12,000" });
    expect(guidance.waits).toContainEqual(expect.objectContaining({ who: "staff", section: "transaction", text: "支払案内の状況を確認" }));
    expect(guidance.waits.some(wait => wait.who === "client")).toBe(false);
    expect(guidance.primary.section).toBe("transaction");
    expect(result.model.facts.payment.state).toBe("absent");
    expect(result.model.facts.link.state).toBe("absent");
    expect(result.model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
  });

  it("passes the generated fixture's explicit timeline through the ordinary reader and shared guidance", async () => {
    const generated = fixtureRows(), row = fixture(true);
    Object.assign(row.project, generated.natori_projects[0], { active_quote_id: plan.quote,
      quote_accepted_at: plan.fixtureTimes.acceptedAt, quote_accepted_amount: 12000 });
    Object.assign(row.sections.financial_quotes.rows[0], generated.natori_quotes[0]);
    const { result, guidance } = await read(row);
    expect(result.model.agreement).toBe("accepted");
    expect(guidance.status).toBe("見積承諾済み");
    expect(guidance.facts).toContainEqual({ label: "合意した金額", value: "￥12,000" });
    expect(guidance.waits.some(wait => wait.who === "client")).toBe(false);
    expect(guidance.primary.section).toBe("transaction");
  });
});
