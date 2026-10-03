import { NATORI_INTAKE_COPY } from "@/features/natori/constants/portfolioContactCopy";
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
    body: `ご相談・ご依頼フォームから、ご希望の内容や資料をお送りください。受付確認のメールが届きます。${NATORI_INTAKE_COPY.notConfirmed}`,
  },
  {
    title: "内容のご相談・お見積もり",
    body: `${NATORI_INTAKE_COPY.reply}${NATORI_INTAKE_COPY.next}`,
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
    body: "ラフ確定後に清書を進めます。色味などの軽微な修正のみ対応可能です。完成後はメールで納品ページをご案内します。ページから完成データをダウンロードし、「受け取りました」を押していただくと納品完了です。",
  },
];

// Exact anonymous public observation: 2026-10-01T22:39:38.802185Z.
// Workflow SHA-256: 1e1058b4e37ab585bc21f80a05adf0ff59c8cc4a4e209ab405a73747db2a6d65.
// A display-only compatibility projection; never save these values back to DB.
const OBSERVED_PUBLIC_WORKFLOW_20261001: Workflow = [
  {
    "title": "ご依頼フォームから送信",
    "body": "このページのご依頼フォームから、ご希望の内容とキャラクター資料をお送りください。受付確認のメールが自動で届きます。"
  },
  {
    "title": "お見積もり・内容確認",
    "body": "内容を確認のうえ、2〜3日以内にお見積もりメールをお送りします。調整が必要な場合は確定前にご返信ください。ご依頼いただける場合は、メール内の承諾ページから内容を確定してください。"
  },
  {
    "title": "ご依頼確定・お支払い",
    "body": "ご依頼の確定後、カード決済用のお支払いリンクをメールでお送りします。ご入金を確認後、確認メールをお送りして制作を開始します。"
  },
  {
    "title": "カラーラフのご確認",
    "body": "通常イラストは、ラフ確認用リンクをメールでお送りします。構図・表情・配色をご確認いただき、修正のご希望はメールでお知らせください。大きな修正はこの段階でお願いいたします（無料リテイク2回まで）。量産イラストは原則リテイクなしです。"
  },
  {
    "title": "清書・納品",
    "body": "ラフ確定後に清書を進めます。完成後はメールで納品ページをご案内します。ページから完成データをダウンロードし、「受け取りました」を押していただくと納品完了です。"
  }
];

function hasExactWorkflowShape(value: unknown): value is Workflow {
  return Array.isArray(value) && value.every(step => step !== null && typeof step === "object" && !Array.isArray(step)
    && Object.keys(step).length === 2 && Object.hasOwn(step, "title") && Object.hasOwn(step, "body")
    && typeof step.title === "string" && typeof step.body === "string");
}

/** Evaluate on raw stored workflow before schema normalization removes unknown fields. */
export function isPortfolioWorkflowProjectionEligible(value: unknown): boolean {
  return hasExactWorkflowShape(value) && (isLegacyDefaultWorkflow(value) || isObservedPublicWorkflow(value));
}

function isObservedPublicWorkflow(workflow: Workflow): boolean {
  return matchesWorkflow(workflow, OBSERVED_PUBLIC_WORKFLOW_20261001) &&
    hasExactWorkflowShape(workflow);
}

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
    hasExactWorkflowShape(workflow) && (matchesWorkflow(workflow, LEGACY_DEFAULT_WORKFLOW) ||
    matchesWorkflow(workflow, LEGACY_SAVED_WORKFLOW))
  );
}

/**
 * 旧6ステップの標準文面と、記録済みの公開5ステップだけを現行案内へ読み替える。
 * 編集画面で独自に設定したワークフローはそのまま尊重する。
 */
export function resolvePortfolioWorkflow(workflow: Workflow, allowCompatibilityProjection = true): Workflow {
  if (!allowCompatibilityProjection) return workflow;
  if (isLegacyDefaultWorkflow(workflow)) return NATORI_PUBLIC_WORKFLOW;
  if (!isObservedPublicWorkflow(workflow)) return workflow;
  // Change only the three approved U09 fields. Keep all other observed wording,
  // input objects, custom content and saved history/snapshots untouched.
  return workflow.map((step, index) => index === 0
    ? { ...step, body: NATORI_PUBLIC_WORKFLOW[0].body }
    : index === 1
      ? { ...step, title: NATORI_PUBLIC_WORKFLOW[1].title, body: NATORI_PUBLIC_WORKFLOW[1].body }
      : step);
}
