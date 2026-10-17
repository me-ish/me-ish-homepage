import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { NATORI_PUBLIC_WORKFLOW } from "./portfolioWorkflow";

type WorkflowStep = PortfolioContent["workflow"][number];

/**
 * 標準の制作の流れ（NATORI_PUBLIC_WORKFLOW）の要約。大事な条件（確定しないこと・
 * 返信の目安・リテイク回数）は要約にも残し、元の文面は「くわしく」で全文を見せる。
 */
const STANDARD_STEP_SUMMARIES: Record<string, string> = {
  "ご依頼フォームから送信": "フォームからご希望の内容をお送りください。送信だけではご依頼は確定しません。",
  "内容のご相談・お見積もり": "2〜3日以内にお返事し、内容が決まったら金額・納期をご案内します。",
  "ご依頼確定・お支払い": "ご依頼の確定後にカード決済でお支払いいただき、ご入金の確認後に制作を始めます。",
  "カラーラフのご確認": "大きな修正はこの段階でお願いします（通常イラストは無料リテイク2回まで、量産イラストは原則リテイクなし）。",
  "清書・納品": "完成後にメールでご案内する納品ページから、データを受け取っていただきます。",
};

/**
 * 本番に保存されている標準の文面で、NATORI_PUBLIC_WORKFLOW と1文だけ違うもの。
 * （2026-10 時点の公開ページ。清書の行に「色味などの軽微な修正…」の1文がない）
 */
const SAVED_STANDARD_BODIES: Record<string, string[]> = {
  "清書・納品": [
    "ラフ確定後に清書を進めます。完成後はメールで納品ページをご案内します。ページから完成データをダウンロードし、「受け取りました」を押していただくと納品完了です。",
  ],
};

function isStandardStep(step: WorkflowStep): boolean {
  return NATORI_PUBLIC_WORKFLOW.some((item) => item.title === step.title && item.body === step.body)
    || (SAVED_STANDARD_BODIES[step.title] ?? []).includes(step.body);
}

/**
 * 制作の流れの1ステップを「いつも見せる短い説明」と「くわしく」で開く全文に分ける。
 * 要約があるのは標準の文面だけ。編集された文面は書かれたとおり全文を見せる（detail は空）。
 */
export function workflowStepView(step: WorkflowStep): { lead: string; detail: string } {
  const summary = isStandardStep(step) ? STANDARD_STEP_SUMMARIES[step.title] : undefined;
  if (summary) return { lead: summary, detail: step.body.trim() };
  return { lead: step.body, detail: "" };
}
