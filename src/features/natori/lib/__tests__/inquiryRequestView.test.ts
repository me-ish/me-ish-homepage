// 原依頼内容の表示モデル。structured / legacy / 表示不能 の3系統と、
// 未定表示・label snapshot・raw JSON 非表示を固定する。
import { describe, expect, it } from "vitest";
import {
  NATORI_UNSPECIFIED_DISPLAY,
  NATORI_UNSUPPORTED_REQUEST_MESSAGE,
  buildNatoriInquiryRequestView,
} from "@/features/natori/lib/inquiryRequestView";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

function requestData(overrides: Partial<NatoriRequestDataV1> = {}): unknown {
  return {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "consultation",
    requestType: "undecided",
    requestTypeOther: null,
    commissionScope: "undecided",
    commissionScopeOther: null,
    options: [],
    usageTypes: [],
    usageTypeOther: null,
    commercialUse: "unknown",
    publicationPolicy: "unknown",
    budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
    deadline: { kind: "undecided", date: null, note: "" },
    characterFeatures: "",
    expressionMood: "",
    composition: "",
    colorDirection: "",
    referenceNotes: "",
    message: "ご相談させてください。",
    legacySource: null,
    ...overrides,
  };
}

function fieldValue(
  view: ReturnType<typeof buildNatoriInquiryRequestView>,
  key: string
): string | undefined {
  if (view.kind !== "structured") return undefined;
  for (const section of view.sections) {
    const field = section.fields.find((item) => item.key === key);
    if (field) return field.value;
  }
  return undefined;
}

describe("structured view", () => {
  it("consultation を field ごとに表示する", () => {
    const view = buildNatoriInquiryRequestView(requestData());
    expect(view.kind).toBe("structured");
    if (view.kind !== "structured") return;
    expect(view.inquiryMode).toBe("consultation");
    expect(view.modeLabel).toBe("まず相談したい");
    expect(fieldValue(view, "requestType")).toBe("未定・相談して決めたい");
    expect(fieldValue(view, "commissionScope")).toBe("未定・相談して決めたい");
    expect(fieldValue(view, "message")).toBe("ご相談させてください。");
  });

  it("quote を区別して表示する", () => {
    const view = buildNatoriInquiryRequestView(
      requestData({ inquiryMode: "quote" } as Partial<NatoriRequestDataV1>)
    );
    expect(view.kind).toBe("structured");
    if (view.kind !== "structured") return;
    expect(view.inquiryMode).toBe("quote");
    expect(view.modeLabel).toBe("見積もりを希望");
  });

  it("未定・未選択は空欄ではなく既存の表示語になる", () => {
    const view = buildNatoriInquiryRequestView(requestData());
    expect(fieldValue(view, "budget")).toBe("未定");
    expect(fieldValue(view, "deadline")).toBe("未定");
    expect(fieldValue(view, "usageTypes")).toBe("未定");
    expect(fieldValue(view, "options")).toBe("なし");
    expect(fieldValue(view, "commercialUse")).toBe("わからない・相談したい");
    expect(fieldValue(view, "publicationPolicy")).toBe("わからない・相談したい");
  });

  it("任意項目が空なら未記入と表示する", () => {
    const view = buildNatoriInquiryRequestView(requestData());
    expect(fieldValue(view, "characterFeatures")).toBe(NATORI_UNSPECIFIED_DISPLAY);
    expect(fieldValue(view, "composition")).toBe(NATORI_UNSPECIFIED_DISPLAY);
  });

  it("option は送信時の label snapshot と quantity / notes を表示し、ID を主表示にしない", () => {
    const view = buildNatoriInquiryRequestView(
      requestData({
        options: [
          { id: "expression_variation", label: "表情差分", quantity: 2, notes: "笑顔と泣き顔" },
        ],
      } as Partial<NatoriRequestDataV1>)
    );
    const value = fieldValue(view, "options");
    expect(value).toBe("表情差分 ×2（笑顔と泣き顔）");
    expect(value).not.toContain("expression_variation");
  });

  it("公開延期は公開可能日を併記する", () => {
    const view = buildNatoriInquiryRequestView(requestData({
      publicationPolicy: "delayed",
      publicationAllowedFrom: "2026-10-15",
    }));
    expect(fieldValue(view, "publicationPolicy")).toBe(
      "一定期間後なら公開してよい（2026年10月15日から）"
    );
  });

  it("other の補足を併記する", () => {
    const view = buildNatoriInquiryRequestView(
      requestData({
        requestType: "other",
        requestTypeOther: "アクリルスタンド",
      } as Partial<NatoriRequestDataV1>)
    );
    expect(fieldValue(view, "requestType")).toBe("その他（アクリルスタンド）");
  });
});

describe("legacy view", () => {
  it("request_data が null なら legacy として note 表示へ委ねる", () => {
    expect(buildNatoriInquiryRequestView(null).kind).toBe("legacy");
    expect(buildNatoriInquiryRequestView(undefined).kind).toBe("legacy");
  });
});

describe("unsupported view", () => {
  it("未知 schemaVersion は unknown_version として扱い、throw しない", () => {
    const view = buildNatoriInquiryRequestView(requestData({ schemaVersion: 2 } as never));
    expect(view).toEqual({
      kind: "unsupported",
      issue: "request_data_unknown_version",
      message: NATORI_UNSUPPORTED_REQUEST_MESSAGE,
    });
  });

  it("未知 formVersion は invalid として扱う", () => {
    const view = buildNatoriInquiryRequestView(
      requestData({ formVersion: "future-form-v9" } as never)
    );
    expect(view.kind).toBe("unsupported");
    if (view.kind !== "unsupported") return;
    expect(view.issue).toBe("request_data_invalid");
  });

  it("JSON shape 不正・field 欠損・unknown enum でも throw しない", () => {
    for (const value of [
      "not-an-object",
      42,
      [],
      {},
      { schemaVersion: 1 },
      requestData({ commercialUse: "maybe" } as never),
      requestData({ legacySource: { formVersion: "???" } } as never),
    ]) {
      const view = buildNatoriInquiryRequestView(value);
      expect(view.kind).toBe("unsupported");
    }
  });

  it("表示不能でも raw JSON を message に含めない", () => {
    const view = buildNatoriInquiryRequestView({
      schemaVersion: 1,
      message: "秘密のメッセージ",
      clientEmail: "client@example.com",
    });
    expect(view.kind).toBe("unsupported");
    if (view.kind !== "unsupported") return;
    expect(view.message).not.toContain("秘密のメッセージ");
    expect(view.message).not.toContain("client@example.com");
    expect(view.message).not.toContain("schemaVersion");
  });
});
