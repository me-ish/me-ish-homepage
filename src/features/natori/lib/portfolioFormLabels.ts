// features/natori/lib/portfolioFormLabels.ts
// 依頼フォーム（依頼者が見る画面）で使う言葉。入力画面・確認画面・ポートフォリオの呼び名をそろえる。
// 管理画面の言葉（inquiryRequestView）はここでは変えない。
import {
  NATORI_PUBLICATION_POLICY_LABELS_V1,
  formatNatoriRequestDate,
} from "./requestPresentation";
import type { NatoriInquiryRequestSection } from "./inquiryRequestView";
import type { NatoriRequestDataV1 } from "../types/request";

/** 掲載設定の追加オプション（名前と料金）。ポートフォリオの料金表と同じものを渡す。 */
export type PortfolioPricedOption = { id?: string | null; name: string; price: string };

type PublicationPolicy = NatoriRequestDataV1["publicationPolicy"];

// 実績掲載の選択肢と、ポートフォリオの追加オプションの対応（constants の PORTFOLIO_OPTION_IDS と同じ値）。
const PUBLICATION_OPTION_ID: Partial<Record<PublicationPolicy, string>> = {
  work_private: "sample_usage_denied",
  fully_private: "private_work",
};

/**
 * 実績掲載の選択肢名。料金のかかるものはポートフォリオの呼び名と料金で出す
 * （例：「サンプル使用不可（+1,000円）」）。「一定期間後なら公開してよい」は無料。
 */
export function portfolioPublicationLabel(
  policy: PublicationPolicy,
  options: readonly PortfolioPricedOption[],
): string {
  if (policy === "delayed") return `${NATORI_PUBLICATION_POLICY_LABELS_V1.delayed}（無料）`;
  const optionId = PUBLICATION_OPTION_ID[policy];
  const option = optionId ? options.find((item) => item.id === optionId) : undefined;
  if (!option) return NATORI_PUBLICATION_POLICY_LABELS_V1[policy];
  const name = option.name.trim() || NATORI_PUBLICATION_POLICY_LABELS_V1[policy];
  const price = option.price.trim();
  return price ? `${name}（${price}）` : name;
}

function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** 予算を入力画面のチップと同じ形で出す（「0円〜5,000円」ではなく「〜5,000円」）。 */
function portfolioBudgetLabel(budget: NatoriRequestDataV1["budget"], fallback: string): string {
  if (budget.kind === "range" && budget.min === 0 && budget.max !== null) return `〜${yen(budget.max)}`;
  return fallback;
}

/** 確認画面の項目名と値を、入力画面で見た言葉に置き換える。 */
export function relabelPortfolioConfirmation(
  sections: NatoriInquiryRequestSection[],
  request: NatoriRequestDataV1,
  options: readonly PortfolioPricedOption[],
): NatoriInquiryRequestSection[] {
  return sections.map((section) => {
    // 入力画面は「描くもの」のカード1つ。種類（SD・それ以外など）と範囲が両方出るときだけ「描く範囲」と分ける。
    const hasType = section.fields.some((field) => field.key === "requestType");
    return {
    ...section,
    fields: section.fields.map((field) => {
      switch (field.key) {
        case "inquiryMode":
          return { ...field, label: "ご希望" };
        case "requestType":
          return { ...field, label: "描くもの" };
        case "commissionScope":
          return { ...field, label: hasType ? "描く範囲" : "描くもの" };
        case "usageTypes":
          return { ...field, label: request.inquiryMode === "quote" ? "使いみち" : "使用目的" };
        case "publicationPolicy": {
          const label = portfolioPublicationLabel(request.publicationPolicy, options);
          const value = request.publicationPolicy === "delayed" && request.publicationAllowedFrom
            ? `${NATORI_PUBLICATION_POLICY_LABELS_V1.delayed}（${formatNatoriRequestDate(request.publicationAllowedFrom)}から）`
            : label;
          return { ...field, label: "実績掲載", value };
        }
        case "budget":
          return { ...field, label: "ご予算", value: portfolioBudgetLabel(request.budget, field.value) };
        default:
          return field;
      }
    }),
    };
  });
}
