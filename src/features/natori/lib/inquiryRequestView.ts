// features/natori/lib/inquiryRequestView.ts
// 問い合わせ詳細の「原依頼内容」表示モデル。
// request_data (RequestData V1) / legacy note / 未対応データの3系統を判別し、
// UI が分岐ロジックを持たなくて済む presentation model へ落とす。
// DB・fetch・process.env には依存しない純関数だけを置く。
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import {
  NATORI_COMMERCIAL_USE_LABELS_V1,
  NATORI_INQUIRY_MODE_LABELS_V1,
  NATORI_PUBLICATION_POLICY_LABELS_V1,
  describeNatoriBudget,
  describeNatoriCommissionScope,
  describeNatoriDeadline,
  describeNatoriRequestType,
  describeNatoriSelectedOptions,
  describeNatoriUsageTypes,
} from "@/features/natori/lib/requestPresentation";
import type {
  NatoriInquiryModeV1,
  NatoriRequestDataV1,
} from "@/features/natori/types/request";

/** 値が空のときの共通表示語。空欄のままにしない。 */
export const NATORI_UNSPECIFIED_DISPLAY = "未記入";

/**
 * parse 失敗時に log へ残してよい安全な分類。
 * 依頼者名・メール・本文・raw JSON・URL・Storage path は含めない。
 */
export type NatoriRequestDataIssueCode =
  | "request_data_invalid"
  | "request_data_unknown_version";

export type NatoriInquiryRequestField = {
  /** test と再利用のための安定キー。UI の主表示には使わない。 */
  key: string;
  label: string;
  value: string;
};

export type NatoriInquiryRequestSection = {
  key: string;
  title: string;
  fields: NatoriInquiryRequestField[];
};

export type NatoriInquiryRequestView =
  | {
      kind: "structured";
      inquiryMode: NatoriInquiryModeV1;
      modeLabel: string;
      sections: NatoriInquiryRequestSection[];
      request: NatoriRequestDataV1;
    }
  /** request_data が無い旧案件。既存の note parser 表示を使う。 */
  | { kind: "legacy" }
  /** 現在の画面で完全に表示できないデータ。画面全体は壊さない。 */
  | {
      kind: "unsupported";
      issue: NatoriRequestDataIssueCode;
      message: string;
    };

export const NATORI_UNSUPPORTED_REQUEST_MESSAGE =
  "この依頼データは現在の画面では完全に表示できません。案件の基本情報とメモのみ表示しています。";

function textOrPlaceholder(value: string): string {
  return value.trim().length > 0 ? value : NATORI_UNSPECIFIED_DISPLAY;
}

function buildSections(request: NatoriRequestDataV1): NatoriInquiryRequestSection[] {
  return [
    {
      key: "request",
      title: "依頼の内容",
      fields: [
        {
          key: "inquiryMode",
          label: "受付区分",
          value: NATORI_INQUIRY_MODE_LABELS_V1[request.inquiryMode],
        },
        {
          key: "requestType",
          label: "依頼種類",
          value: describeNatoriRequestType(request),
        },
        {
          key: "commissionScope",
          label: "制作範囲",
          value: describeNatoriCommissionScope(request),
        },
        {
          key: "options",
          label: "追加オプション",
          value: describeNatoriSelectedOptions(request),
        },
      ],
    },
    {
      key: "usage",
      title: "用途・条件",
      fields: [
        {
          key: "usageTypes",
          label: "使用目的",
          value: describeNatoriUsageTypes(request),
        },
        {
          key: "commercialUse",
          label: "商用利用",
          value: NATORI_COMMERCIAL_USE_LABELS_V1[request.commercialUse],
        },
        {
          key: "publicationPolicy",
          label: "公開可否",
          value: NATORI_PUBLICATION_POLICY_LABELS_V1[request.publicationPolicy],
        },
      ],
    },
    {
      key: "conditions",
      title: "予算・納期",
      fields: [
        { key: "budget", label: "予算", value: describeNatoriBudget(request.budget) },
        {
          key: "deadline",
          label: "希望納期",
          value: describeNatoriDeadline(request.deadline),
        },
      ],
    },
    {
      key: "details",
      title: "詳細",
      fields: [
        {
          key: "characterFeatures",
          label: "キャラクターの特徴",
          value: textOrPlaceholder(request.characterFeatures),
        },
        {
          key: "expressionMood",
          label: "表情・雰囲気",
          value: textOrPlaceholder(request.expressionMood),
        },
        {
          key: "composition",
          label: "構図",
          value: textOrPlaceholder(request.composition),
        },
        {
          key: "colorDirection",
          label: "色味",
          value: textOrPlaceholder(request.colorDirection),
        },
        {
          key: "referenceNotes",
          label: "資料の補足",
          value: textOrPlaceholder(request.referenceNotes),
        },
        {
          key: "message",
          label: "メッセージ",
          value: textOrPlaceholder(request.message),
        },
      ],
    },
  ];
}

/**
 * request_data から表示モデルを作る。
 * 未知 version / 壊れた JSON でも throw せず unsupported を返し、
 * 案件ページ全体が error にならないようにする。
 */
export function buildNatoriInquiryRequestView(
  requestData: unknown
): NatoriInquiryRequestView {
  if (requestData === null || requestData === undefined) return { kind: "legacy" };

  const result = readNatoriRequestData(requestData);
  if (!result.success) {
    return {
      kind: "unsupported",
      issue:
        result.reason === "unsupported_version"
          ? "request_data_unknown_version"
          : "request_data_invalid",
      message: NATORI_UNSUPPORTED_REQUEST_MESSAGE,
    };
  }

  const request = result.data;
  return {
    kind: "structured",
    inquiryMode: request.inquiryMode,
    modeLabel: NATORI_INQUIRY_MODE_LABELS_V1[request.inquiryMode],
    sections: buildSections(request),
    request,
  };
}
