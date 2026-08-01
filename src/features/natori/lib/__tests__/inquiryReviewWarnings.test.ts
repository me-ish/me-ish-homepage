// 見積もり前の要確認事項。未確定項目ごとに warning が出ること、
// すべて確定していれば不要な warning が出ないことを固定する。
import { describe, expect, it } from "vitest";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import {
  collectNatoriInquiryReviewWarnings,
  countNatoriReviewBlockers,
  type NatoriInquiryReviewInput,
  type NatoriReviewWarningCode,
} from "@/features/natori/lib/inquiryReviewWarnings";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

function requestData(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "quote",
    requestType: "icon",
    requestTypeOther: null,
    commissionScope: "bust_up",
    commissionScopeOther: null,
    options: [],
    usageTypes: ["social_icon"],
    usageTypeOther: null,
    commercialUse: "none",
    publicationPolicy: "allowed",
    budget: { kind: "fixed", min: 8000, max: 8000, currency: "JPY" },
    deadline: { kind: "preferred_date", date: "2026-09-01", note: "" },
    characterFeatures: "黒髪ロング",
    expressionMood: "",
    composition: "",
    colorDirection: "",
    referenceNotes: "",
    message: "よろしくお願いします。",
    legacySource: null,
    ...overrides,
  };
}

/** 全項目が確定済みの基準ケース。 */
function settledInput(overrides: Partial<NatoriInquiryReviewInput> = {}) {
  return {
    projectType: "icon" as const,
    amount: 8000,
    dueDateISO: "2026-09-01",
    isPrework: true,
    requestView: buildNatoriInquiryRequestView(requestData()),
    ...overrides,
  };
}

function codes(input: NatoriInquiryReviewInput): NatoriReviewWarningCode[] {
  return collectNatoriInquiryReviewWarnings(input).map((warning) => warning.code);
}

describe("project 側の未確定", () => {
  it("type 未確定を blocker として出す", () => {
    const warnings = collectNatoriInquiryReviewWarnings(
      settledInput({ projectType: "undecided" })
    );
    const warning = warnings.find((item) => item.code === "project_type_unconfirmed");
    expect(warning?.severity).toBe("blocker");
    expect(warning?.action).toContain("案件種別を確定");
    expect(warning?.sourceField).toBe("project.type");
  });

  it("amount 未確定を出す（0 は無料なので出さない）", () => {
    expect(codes(settledInput({ amount: null }))).toContain("amount_undecided");
    expect(codes(settledInput({ amount: 0 }))).not.toContain("amount_undecided");
  });

  it("due date 未確定を出す", () => {
    expect(codes(settledInput({ dueDateISO: null }))).toContain("due_date_undecided");
  });

  it("納期未確定の prework では納期プラン未確定も出す", () => {
    expect(codes(settledInput({ dueDateISO: null }))).toContain(
      "delivery_plan_unconfirmed"
    );
    expect(codes(settledInput({ dueDateISO: "2026-09-01" }))).not.toContain(
      "delivery_plan_unconfirmed"
    );
  });
});

describe("request_data 側の未確定", () => {
  it.each([
    ["requestType", { requestType: "undecided" }, "request_type_undecided"],
    ["commissionScope", { commissionScope: "undecided" }, "commission_scope_undecided"],
    ["commercialUse", { commercialUse: "unknown" }, "commercial_use_unknown"],
    ["publicationPolicy", { publicationPolicy: "unknown" }, "publication_policy_unknown"],
    [
      "budget",
      { budget: { kind: "undecided", min: null, max: null, currency: "JPY" } },
      "budget_undecided",
    ],
    [
      "deadline",
      { deadline: { kind: "undecided", date: null, note: "" } },
      "deadline_undecided",
    ],
  ])("%s が未定なら warning を出す", (_name, overrides, expected) => {
    const view = buildNatoriInquiryRequestView(requestData(overrides));
    const result = codes(settledInput({ requestView: view }));
    expect(result).toContain(expected as NatoriReviewWarningCode);
  });

  it("依頼者側の未定は attention（管理者の確定ではないため）", () => {
    const view = buildNatoriInquiryRequestView(
      requestData({ commercialUse: "unknown" })
    );
    const warning = collectNatoriInquiryReviewWarnings(
      settledInput({ requestView: view })
    ).find((item) => item.code === "commercial_use_unknown");
    expect(warning?.severity).toBe("attention");
  });
});

describe("表示不能な request_data", () => {
  it("invalid は blocker として1件だけ出し、依頼内容側の判定は行わない", () => {
    const view = buildNatoriInquiryRequestView({ schemaVersion: 1, broken: true });
    const warnings = collectNatoriInquiryReviewWarnings(
      settledInput({ requestView: view })
    );
    expect(warnings.map((item) => item.code)).toEqual(["request_data_invalid"]);
    expect(warnings[0].severity).toBe("blocker");
  });

  it("unknown version も専用 code で出す", () => {
    const view = buildNatoriInquiryRequestView(requestData({ schemaVersion: 3 }));
    expect(codes(settledInput({ requestView: view }))).toEqual([
      "request_data_unknown_version",
    ]);
  });
});

describe("legacy と確定済み", () => {
  it("legacy 案件は project 側の未確定だけを見る", () => {
    const view = buildNatoriInquiryRequestView(null);
    expect(codes(settledInput({ requestView: view }))).toEqual([]);
    expect(codes(settledInput({ requestView: view, amount: null }))).toEqual([
      "amount_undecided",
    ]);
  });

  it("全項目確定時は warning を出さない", () => {
    const warnings = collectNatoriInquiryReviewWarnings(settledInput());
    expect(warnings).toEqual([]);
    expect(countNatoriReviewBlockers(warnings)).toBe(0);
  });

  it("blocker 件数を数えられる", () => {
    const warnings = collectNatoriInquiryReviewWarnings(
      settledInput({ projectType: "undecided", amount: null, dueDateISO: null })
    );
    expect(countNatoriReviewBlockers(warnings)).toBe(3);
  });
});

describe("型の安定性", () => {
  it("warning は code / severity / title / action / sourceField を持つ", () => {
    const [warning] = collectNatoriInquiryReviewWarnings(
      settledInput({ amount: null })
    );
    expect(Object.keys(warning).sort()).toEqual([
      "action",
      "code",
      "severity",
      "sourceField",
      "title",
    ]);
  });
});

// 型だけ参照して未使用 import を避ける
export type _RequestData = NatoriRequestDataV1;
