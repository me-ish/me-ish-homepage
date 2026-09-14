import type { PortfolioContent } from "@/features/natori/types/portfolio";

const LEGACY_DEFAULT_WORKFLOW_TITLES = [
  "ご依頼フォームから送信",
  "お見積もりのご案内",
  "ご承諾・お支払い",
  "カラーラフのご確認",
  "清書・最終確認",
  "納品",
] as const;

/**
 * 実際のメール・決済・納品フローに合わせた公開用の標準表示。
 * 通常イラストと量産イラストでリテイク条件が異なることもここで明示する。
 */
export const NATORI_PUBLIC_WORKFLOW: PortfolioContent["workflow"] = [
  {
    title: "ご依頼フォームから送信",
    body: "このページのご依頼フォームから、ご希望の内容とキャラクター資料をお送りください。受付確認のメールが自動で届きます。",
  },
  {
    title: "お見積もり・内容確認",
    body: "内容を確認のうえ、2〜3日以内にお見積もりメールをお送りします。調整が必要な場合は確定前にご返信ください。ご依頼いただける場合は、メール内の承諾ページから内容を確定してください。",
  },
  {
    title: "ご依頼確定・お支払い",
    body: "ご依頼の確定後、カード決済用のお支払いリンクをメールでお送りします。ご入金を確認後、確認メールをお送りして制作を開始します。",
  },
  {
    title: "カラーラフのご確認",
    body: "通常イラストは、ラフ確認用リンクをメールでお送りします。構図・表情・配色をご確認いただき、修正のご希望はメールでお知らせください。大きな修正はこの段階でお願いいたします（無料リテイク2回まで）。量産イラストは原則リテイクなしです。",
  },
  {
    title: "清書・納品",
    body: "ラフ確定後に清書を進めます。完成後はメールで納品ページをご案内します。ページから完成データをダウンロードし、「受け取りました」を押していただくと納品完了です。",
  },
];

function isLegacyDefaultWorkflow(workflow: PortfolioContent["workflow"]): boolean {
  return (
    workflow.length === LEGACY_DEFAULT_WORKFLOW_TITLES.length &&
    workflow.every((step, index) => step.title === LEGACY_DEFAULT_WORKFLOW_TITLES[index])
  );
}

/**
 * 旧6ステップの標準文面だけを現行フローへ読み替える。
 * 編集画面で独自に設定したワークフローはそのまま尊重する。
 */
export function resolvePortfolioWorkflow(
  workflow: PortfolioContent["workflow"]
): PortfolioContent["workflow"] {
  return isLegacyDefaultWorkflow(workflow) ? NATORI_PUBLIC_WORKFLOW : workflow;
}
