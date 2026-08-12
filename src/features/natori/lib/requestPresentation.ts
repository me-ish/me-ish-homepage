// features/natori/lib/requestPresentation.ts
// RequestData V1 の表示語（label snapshot）と要約整形。UI と通知メールで同じ
// 表示語を使い、stable ID を label から推定しないための単方向 mapping を置く。
// DB・fetch・process.env には依存しない純関数だけを置く。
import type {
  NatoriBudgetV1,
  NatoriCommissionScopeV1,
  NatoriDeadlineV1,
  NatoriInquiryModeV1,
  NatoriRequestDataV1,
  NatoriRequestTypeV1,
  NatoriUsageTypeV1,
} from "@/features/natori/types/request";

/**
 * natori_create_project_with_tasks_v2 が案件 title に使う表示語と同一。
 * 変更する場合は RPC 側の CASE 式と同時に更新する。
 */
export const NATORI_REQUEST_TYPE_LABELS_V1: Readonly<
  Record<NatoriRequestTypeV1, string>
> = {
  undecided: "未定・相談して決めたい",
  icon: "SNSアイコン",
  sd: "SDキャラクター",
  standing: "立ち絵",
  illustration: "一枚絵",
  other: "その他",
};

export const NATORI_COMMISSION_SCOPE_LABELS_V1: Readonly<
  Record<NatoriCommissionScopeV1, string>
> = {
  undecided: "未定・相談して決めたい",
  bust_up: "胸上",
  waist_up: "膝〜腰上",
  full_body: "全身",
  other: "その他",
};

export const NATORI_USAGE_TYPE_LABELS_V1: Readonly<
  Record<NatoriUsageTypeV1, string>
> = {
  social_icon: "SNSアイコン",
  streaming: "配信で使用",
  video_thumbnail: "動画サムネイル",
  trpg: "TRPG",
  original_character: "オリジナルキャラクター",
  print: "印刷物",
  merchandise: "グッズ",
  advertising: "広告・宣伝",
  other: "その他",
};

export const NATORI_COMMERCIAL_USE_LABELS_V1: Readonly<
  Record<NatoriRequestDataV1["commercialUse"], string>
> = {
  none: "商用利用しない",
  yes: "商用利用する",
  unknown: "わからない・相談したい",
};

export const NATORI_PUBLICATION_POLICY_LABELS_V1: Readonly<
  Record<NatoriRequestDataV1["publicationPolicy"], string>
> = {
  allowed: "公開してよい",
  delayed: "一定期間後なら公開してよい",
  work_private: "作品の公開は不可",
  fully_private: "完全非公開",
  unknown: "わからない・相談したい",
};

export function describeNatoriPublicationPolicy(data: NatoriRequestDataV1): string {
  const label = NATORI_PUBLICATION_POLICY_LABELS_V1[data.publicationPolicy];
  if (data.publicationPolicy !== "delayed" || !data.publicationAllowedFrom) return label;
  const [year, month, day] = data.publicationAllowedFrom.split("-").map(Number);
  return `${label}（${year}年${month}月${day}日から）`;
}

export const NATORI_INQUIRY_MODE_LABELS_V1: Readonly<
  Record<NatoriInquiryModeV1, string>
> = {
  consultation: "まず相談したい",
  quote: "見積もりを希望",
};

export const NATORI_BUDGET_KIND_LABELS_V1: Readonly<
  Record<NatoriBudgetV1["kind"], string>
> = {
  undecided: "未定・相談して決めたい",
  range: "だいたいの範囲で伝える",
  fixed: "金額を1つ指定する",
};

export const NATORI_DEADLINE_KIND_LABELS_V1: Readonly<
  Record<NatoriDeadlineV1["kind"], string>
> = {
  undecided: "未定・相談して決めたい",
  standard: "通常納期でよい",
  preferred_date: "希望日がある",
  rush_consultation: "お急ぎ希望（要相談）",
};

const UNDECIDED_DISPLAY = "未定";

function formatJpy(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** other の場合だけ依頼者の補足を併記する。label から ID は復元しない。 */
export function describeNatoriRequestType(data: NatoriRequestDataV1): string {
  const base = NATORI_REQUEST_TYPE_LABELS_V1[data.requestType];
  if (data.requestType !== "other") return base;
  return data.requestTypeOther ? `${base}（${data.requestTypeOther}）` : base;
}

export function describeNatoriCommissionScope(data: NatoriRequestDataV1): string {
  const base = NATORI_COMMISSION_SCOPE_LABELS_V1[data.commissionScope];
  if (data.commissionScope !== "other") return base;
  return data.commissionScopeOther ? `${base}（${data.commissionScopeOther}）` : base;
}

export function describeNatoriBudget(budget: NatoriBudgetV1): string {
  switch (budget.kind) {
    case "undecided":
      return UNDECIDED_DISPLAY;
    case "fixed":
      return formatJpy(budget.min);
    case "range":
      return budget.max === null
        ? `${formatJpy(budget.min)}〜`
        : `${formatJpy(budget.min)}〜${formatJpy(budget.max)}`;
  }
}

export function describeNatoriDeadline(deadline: NatoriDeadlineV1): string {
  const base = (() => {
    switch (deadline.kind) {
      case "undecided":
        return UNDECIDED_DISPLAY;
      case "standard":
        return "通常納期";
      case "preferred_date":
        return `${deadline.date} 希望`;
      case "rush_consultation":
        return deadline.date ? `お急ぎ希望（${deadline.date}）` : "お急ぎ希望";
    }
  })();
  return deadline.note ? `${base} / ${deadline.note}` : base;
}

export function describeNatoriUsageTypes(data: NatoriRequestDataV1): string {
  if (data.usageTypes.length === 0) return UNDECIDED_DISPLAY;
  const labels = data.usageTypes.map((usage) =>
    usage === "other" && data.usageTypeOther
      ? `${NATORI_USAGE_TYPE_LABELS_V1.other}（${data.usageTypeOther}）`
      : NATORI_USAGE_TYPE_LABELS_V1[usage]
  );
  return labels.join(" / ");
}

/** 選択オプションは送信時 label snapshot を表示に使う（現行 config を再参照しない）。 */
export function describeNatoriSelectedOptions(data: NatoriRequestDataV1): string {
  if (data.options.length === 0) return "なし";
  return data.options
    .map((option) => {
      const quantity = option.quantity > 1 ? ` ×${option.quantity}` : "";
      const notes = option.notes ? `（${option.notes}）` : "";
      return `${option.label}${quantity}${notes}`;
    })
    .join(" / ");
}
