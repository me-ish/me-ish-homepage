import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import { parsePortfolioContent } from "@/features/natori/lib/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";
import type { NatoriQuoteTerms } from "@/features/natori/lib/quoteTerms";
import type { NatoriAgreedTerms } from "@/features/natori/lib/estimateDraft";
import type { NatoriQuoteSnapshotItemV1 } from "@/features/natori/types/quoteSnapshot";
// Anonymous published workflow observed 2026-10-01; exact legacy rows test the real public read projection.
export const observedWorkflow: PortfolioContent["workflow"] = [
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
export const seedContent: PortfolioContent = {
  ...defaultPortfolioContent, artistName: "Synthetic Phase 7 artist",
  commissionOpen: true, massProductionIllustrationOpen: true,
  heroImage: "/phase7-art/work-1.svg", heroImages: ["/phase7-art/work-1.svg", "/phase7-art/work-2.svg", "/phase7-art/work-3.svg"],
  aboutImage: "/phase7-art/work-4.svg", massProductionSamples: [], workflow: observedWorkflow,
  socialLinks: [],
  works: Array.from({ length: 8 }, (_, index) => ({
    id: `phase7-work-${index + 1}`, title: `Phase 7 synthetic work ${index + 1}`,
    productionMonth: "2026-09", tags: ["Synthetic"], image: `/phase7-art/work-${index + 1}.svg`,
    collectionId: ["illustration", "icon", "standing", "illustration", "icon", "standing", "illustration", "illustration"][index],
    featured: true, published: true,
    relatedLinks: index === 0 ? [{ id: "phase7-usage", kind: "usage", label: "Synthetic usage reference", href: "https://phase7.invalid/usage" }] : [],
  })),
};
if (!parsePortfolioContent(seedContent)) throw new Error("INVALID_PORTFOLIO_FIXTURE");
export const requestData: NatoriRequestDataV1 = {
  schemaVersion: 1, formVersion: "etorie-request-v1", inquiryMode: "quote", requestType: "illustration", requestTypeOther: null,
  commissionScope: "full_body", commissionScopeOther: null, options: [], usageTypes: ["video_thumbnail"], usageTypeOther: null,
  commercialUse: "yes", publicationPolicy: "delayed", publicationAllowedFrom: "2026-11-15",
  budget: { kind: "fixed", min: 12000, max: 12000, currency: "JPY" },
  deadline: { kind: "preferred_date", date: "2026-11-15", note: "Synthetic deadline" },
  characterFeatures: "Synthetic character", expressionMood: "Synthetic smile", composition: "Synthetic standing pose",
  colorDirection: "Synthetic pink and blue", referenceNotes: "Synthetic reference", message: "Synthetic request\nImportant original condition: no AI training",
  legacySource: null,
};
export const quoteTerms: NatoriQuoteTerms = {
  deliverables: "全身イラスト1点・表情差分1点、PNGで納品", dueDate: "2026-11-15", scope: "全身",
  usage: "動画サムネイル・SNS告知", commercialUse: "あり", publication: "2026年11月15日以降に公開可。AI学習は禁止",
};
export const agreedTerms: NatoriAgreedTerms = {
  scope: "full_body", scopeNote: "", deliverables: quoteTerms.deliverables, usage: quoteTerms.usage ?? "",
  commercialUse: "yes", publication: quoteTerms.publication ?? "", dueDate: quoteTerms.dueDate, memo: "Synthetic internal memo",
};
export const items: NatoriQuoteSnapshotItemV1[] = [{
  id: "phase7-base", presetItemId: null, kind: "manual", labelSnapshot: "全身イラスト・表情差分", quantity: 1,
  unitAmount: 12000, amount: 12000, automatic: false, sourceFields: [], ruleId: null, note: "Synthetic saved item",
}];

if (!readNatoriRequestData(requestData).success) throw new Error("INVALID_REQUEST_FIXTURE");
