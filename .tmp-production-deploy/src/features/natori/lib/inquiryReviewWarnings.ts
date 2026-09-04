// features/natori/lib/inquiryReviewWarnings.ts
// 見積もり前に管理者が確定すべき項目の presentation model。
//
// P1-08 の pricing suggestion が同じ warning 一覧へ合流する予定なので、
// 表示文字列の配列ではなく code / severity / action を持つ型として切り出す。
// ここでは pricing engine の判定は行わない（P1-08 の責務）。
// DB・fetch・process.env には依存しない純関数だけを置く。
import type { NatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import type { NatoriProjectType } from "@/features/natori/types/projects";

export type NatoriReviewWarningCode =
  | "project_type_unconfirmed"
  | "amount_undecided"
  | "due_date_undecided"
  | "delivery_plan_unconfirmed"
  | "request_type_undecided"
  | "commission_scope_undecided"
  | "commercial_use_unknown"
  | "publication_policy_unknown"
  | "budget_undecided"
  | "deadline_undecided"
  | "request_data_invalid"
  | "request_data_unknown_version";

/**
 * blocker: 見積もり発行（P1-09）の前に管理者の確定が要るもの。
 * attention: 依頼者が未定のまま送ったため、確認・相談が要るもの。
 */
export type NatoriReviewWarningSeverity = "blocker" | "attention";

export type NatoriReviewWarning = {
  code: NatoriReviewWarningCode;
  severity: NatoriReviewWarningSeverity;
  /** 何が未確定かの見出し。 */
  title: string;
  /** 管理者が次に何をすればよいかの説明。 */
  action: string;
  /** 対応する入力の識別子。P1-08 で pricing warning と突き合わせる。 */
  sourceField: string | null;
};

export type NatoriInquiryReviewInput = {
  projectType: NatoriProjectType;
  amount: number | null;
  dueDateISO: string | null;
  /**
   * delivery_plan は NOT NULL + default なので「既定値のまま」と
   * 「管理者が確定した」を列だけでは区別できない。案件がまだ prework で
   * 納期未確定のときに限り、未適用として扱う。
   * 厳密な確定フラグは将来の schema 変更（P1-09 以降）の課題。
   */
  isPrework: boolean;
  requestView: NatoriInquiryRequestView;
};

/** 見積もり前に確定すべき項目を、確定作業が分かる形で列挙する。 */
export function collectNatoriInquiryReviewWarnings(
  input: NatoriInquiryReviewInput
): NatoriReviewWarning[] {
  const warnings: NatoriReviewWarning[] = [];

  if (input.projectType === "undecided") {
    warnings.push({
      code: "project_type_unconfirmed",
      severity: "blocker",
      title: "案件種別が未確定",
      action: "「案件種別を確定する」から種別を選ぶと、制作タスクが作成されます。",
      sourceField: "project.type",
    });
  }

  if (input.amount === null) {
    warnings.push({
      code: "amount_undecided",
      severity: "blocker",
      title: "金額が未確定",
      action: "見積もり金額を入力してください。無料の場合は 0 を入力します（未確定とは区別されます）。",
      sourceField: "project.amount",
    });
  }

  if (input.dueDateISO === null) {
    warnings.push({
      code: "due_date_undecided",
      severity: "blocker",
      title: "納期が未確定",
      action: "納品予定日を入力してください。未入力のままだとカレンダーと稼働計算に載りません。",
      sourceField: "project.due_date",
    });
  }

  if (input.isPrework && input.dueDateISO === null) {
    warnings.push({
      code: "delivery_plan_unconfirmed",
      severity: "attention",
      title: "納期プランが既定値のまま",
      action: "通常納期／お急ぎ納品を選び直し、納品予定日と揃えてください。",
      sourceField: "project.delivery_plan",
    });
  }

  const view = input.requestView;

  if (view.kind === "unsupported") {
    warnings.push({
      code: view.issue,
      severity: "blocker",
      title:
        view.issue === "request_data_unknown_version"
          ? "依頼データの形式が新しく、表示できません"
          : "依頼データを読み取れません",
      action: "依頼者へ内容を確認するか、受付時のメール控えを参照してください。",
      sourceField: "project.request_data",
    });
    return warnings;
  }

  if (view.kind !== "structured") return warnings;
  const request = view.request;

  if (request.requestType === "undecided") {
    warnings.push({
      code: "request_type_undecided",
      severity: "attention",
      title: "依頼者の希望種類が未定",
      action: "相談のうえ依頼種類を決めてから、案件種別を確定してください。",
      sourceField: "requestData.requestType",
    });
  }

  if (request.commissionScope === "undecided") {
    warnings.push({
      code: "commission_scope_undecided",
      severity: "attention",
      title: "制作範囲が未定",
      action: "胸上／膝〜腰上／全身などの範囲を相談して決めてください。",
      sourceField: "requestData.commissionScope",
    });
  }

  if (request.commercialUse === "unknown") {
    warnings.push({
      code: "commercial_use_unknown",
      severity: "attention",
      title: "商用利用の有無が未確認",
      action: "商用利用の有無で料金が変わります。依頼者に確認してください。",
      sourceField: "requestData.commercialUse",
    });
  }

  if (request.publicationPolicy === "unknown") {
    warnings.push({
      code: "publication_policy_unknown",
      severity: "attention",
      title: "公開可否が未確認",
      action: "制作実績への掲載可否を確認してください。",
      sourceField: "requestData.publicationPolicy",
    });
  }

  if (request.budget.kind === "undecided") {
    warnings.push({
      code: "budget_undecided",
      severity: "attention",
      title: "依頼者の予算が未定",
      action: "見積もり提示前に、予算感をすり合わせておくと差し戻しを減らせます。",
      sourceField: "requestData.budget",
    });
  }

  if (request.deadline.kind === "undecided") {
    warnings.push({
      code: "deadline_undecided",
      severity: "attention",
      title: "依頼者の希望納期が未定",
      action: "希望時期を確認し、納期プランと納品予定日を決めてください。",
      sourceField: "requestData.deadline",
    });
  }

  return warnings;
}

export function countNatoriReviewBlockers(warnings: NatoriReviewWarning[]): number {
  return warnings.filter((warning) => warning.severity === "blocker").length;
}
