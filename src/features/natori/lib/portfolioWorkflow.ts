import type { PortfolioContent } from "@/features/natori/types/portfolio";

type Workflow = PortfolioContent["workflow"];

const LEGACY_DEFAULT_WORKFLOW: Workflow = [
  {
    title: "ご依頼フォームから送信",
    body: "このページのご依頼フォームから、ご希望の内容とキャラクター資料をお送りください。受付確認のメールが自動で届きます。",
  },
  {
    title: "お見積もりのご案内",
    body: "内容を確認のうえ、2〜3日以内にメールでお見積もりをお送りします。内容のご相談・ご調整もお気軽にどうぞ。",
  },
  {
    title: "ご承諾・お支払い",
    body: "お見積もりにご承諾いただけましたら、お支払い用のリンク（カード決済）をメールでお送りします。ご入金の確認後、制作を開始いたします。",
  },
  {
    title: "カラーラフのご確認",
    body: "構図・表情・配色などをご確認いただきます。大きな修正はこの段階でお願いいたします。（無料リテイク2回まで）",
  },
  {
    title: "清書・最終確認",
    body: "完成イラストをご確認いただきます。色味などの軽微な修正のみ対応可能です。",
  },
  {
    title: "納品",
    body: "問題がなければ、完成データをメールでお届けします！",
  },
];

// 本番DBに保存されている旧標準文面。支払い行だけ初期値より古い表記が残っている。
const LEGACY_SAVED_WORKFLOW: Workflow = LEGACY_DEFAULT_WORKFLOW.map((step) => ({ ...step }));
LEGACY_SAVED_WORKFLOW[2] = {
  title: "ご承諾・お支払い",
  body: "お見積もりにご承諾いただけましたら、お支払い用のリンクをメールでお送りします。ご入金の確認後、制作を開始いたします。",
};

/**
 * 実際のメール・決済・納品フローに合わせた公開用の標準表示。
 * 通常イラストと量産イラストでリテイク条件が異なることもここで明示する。
 */
export const NATORI_PUBLIC_WORKFLOW: Workflow = [
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

function matchesWorkflow(left: Workflow, right: Workflow): boolean {
  return (
    left.length === right.length &&
    left.every(
      (step, index) => step.title === right[index]?.title && step.body === right[index]?.body
    )
  );
}

function isLegacyDefaultWorkflow(workflow: Workflow): boolean {
  return (
    matchesWorkflow(workflow, LEGACY_DEFAULT_WORKFLOW) ||
    matchesWorkflow(workflow, LEGACY_SAVED_WORKFLOW)
  );
}

/**
 * 旧6ステップの標準文面だけを現行フローへ読み替える。
 * 編集画面で独自に設定したワークフローはそのまま尊重する。
 */
export function resolvePortfolioWorkflow(workflow: Workflow): Workflow {
  return isLegacyDefaultWorkflow(workflow) ? NATORI_PUBLIC_WORKFLOW : workflow;
}
