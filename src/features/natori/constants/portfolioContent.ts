// features/natori/constants/portfolioContent.ts
// /natori/portfolio (コミッション用ポートフォリオ) のデフォルト掲載内容とデザイントークン。
//
// ★掲載内容の編集について
// 実際の掲載内容は /natori/portfolio/edit の編集画面からブラウザで変更でき、
// DB (natori_portfolio_content) に保存される。ここにあるのは「DBにまだ何も
// 保存されていないときの初期値」なので、コードで直す必要は基本的にない。
// 料金・自己紹介の初期値は つなぐ (https://tsunagu.cloud/users/natonato_o) がベース。

import type { PortfolioContent, PortfolioSocialLink } from "@/features/natori/types/portfolio";

/* ------------------------------------------------------------------
   カラートークン
   ここを書き換えるだけで全体の配色を調整できます
------------------------------------------------------------------- */
export const portfolioColors = {
  paper: "#F7F3FB",
  paperAlt: "#EFE7F7",
  ink: "#2D2A3D",
  inkSoft: "#5B5670",
  pink: "#FF6FA5",
  pinkDeep: "#E84C86",
  mint: "#6FE0C3",
  mintDeep: "#3FBE9E",
  yellow: "#FFD166",
  peach: "#FFB199",
  card: "#FFFFFF",
  tape: "#FFE8A3",
} as const;

const c = portfolioColors;

/* ------------------------------------------------------------------
   デフォルト掲載内容（DB未保存時の初期値）
------------------------------------------------------------------- */
export const defaultPortfolioContent: PortfolioContent = {
  commissionOpen: true,
  artistName: "Natori* illust",
  roleEn: "Cute Anime Illustrator",
  heroTitleAccent: "ナトリ",
  heroTitleTail: "のポートフォリオへようこそ",
  heroDescription:
    "淡いピンクや水色を基調とした、やわらかく可愛い女の子のイラストを描いています。アニメ塗りをベースに、シンプルながらも印象に残る表現を心がけています。",
  heroImage: null,
  aboutImage: null,
  aboutParagraphs: [
    "淡いピンクや水色を基調とした、やわらかく可愛い女の子のイラストを描いています。アニメ塗りをベースに、シンプルながらも印象に残る表現を心がけています。",
    "アイコン・一枚絵・創作キャラクターなどのご依頼を中心にお受けしています。ご希望の雰囲気やこだわりにも丁寧に寄り添い、一枚一枚大切に制作いたします。",
    "「かわいい」「きゅんとする」イラストをお求めの方は、ぜひお気軽にご相談ください。",
  ],
  services: [
    "SNSアイコン",
    "配信用立ち絵",
    "オリジナルキャラクター",
    "TRPG立ち絵",
    "動画サムネイル",
    "一枚絵",
  ],
  works: [
    { id: "work-1", title: "夏色スケッチ", tags: ["一枚絵"], image: null },
    { id: "work-2", title: "おひるねちゃん", tags: ["アイコン"], image: null },
    { id: "work-3", title: "制服ver.", tags: ["立ち絵"], image: null },
    { id: "work-4", title: "推し色コーデ", tags: ["一枚絵"], image: null },
    { id: "work-5", title: "ふわもこパーカー", tags: ["アイコン"], image: null },
    { id: "work-6", title: "きらきら配信衣装", tags: ["立ち絵"], image: null },
  ],
  plans: [
    {
      name: "SDキャラ",
      price: "3,000円",
      desc: "SDフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
    {
      name: "胸上",
      price: "4,000円",
      desc: "胸から上のフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
    {
      name: "膝〜腰上",
      price: "6,000円",
      desc: "膝〜腰上までのフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
    {
      name: "全身",
      price: "10,000円",
      desc: "全身のフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
  ],
  options: [
    { name: "複雑な小物追加", price: "+500円" },
    { name: "ぬいぐるみ / マスコット追加", price: "+500円" },
    { name: "表情差分", price: "+500円" },
    { name: "人物追加", price: "基本料金の+70%" },
    { name: "しっかり背景", price: "+3,000円〜5,000円" },
    { name: "商用利用", price: "+3,000円" },
    { name: "サンプル使用不可", price: "+1,000円" },
    { name: "完全非公開", price: "+2,000円" },
  ],
  deliveryLead:
    "通常納期は、ご依頼確定後から約1ヶ月前後を目安としております。ご依頼内容やスケジュール状況によって前後する場合がございますので、あらかじめご了承ください。",
  deliveryNotes: [
    {
      title: "お急ぎ納品",
      body: "通常より優先して制作を進め、可能な限り早めに納品いたします。内容に応じて、最短7日〜14日前後での納品を予定しております。※スケジュール状況によってはお受けできない場合がございます。お急ぎの場合は事前にご相談ください。",
    },
    {
      title: "サンプル使用不可",
      body: "完成イラストをポートフォリオ・SNS・サンプル画像等へ掲載しないオプションです。",
    },
    {
      title: "完全非公開",
      body: "制作内容・完成イラストを含め、一切公開を行わないオプションです。ご依頼内容そのものも非公開で対応いたします。",
    },
  ],
  workflow: [
    {
      title: "ご購入前にメッセージにてご相談",
      body: "ご依頼内容・キャラクター資料・ご希望の構図などをお送りください。内容確認後、お見積もりをご案内いたします。",
    },
    {
      title: "ご購入・お支払い",
      body: "お見積もり内容に問題がなければ、ご購入をお願いいたします。",
    },
    {
      title: "カラーラフ提出",
      body: "構図・表情・配色などをご確認いただきます。大きな修正はこの段階でお願いいたします。（無料リテイク2回まで）",
    },
    {
      title: "清書・最終確認",
      body: "完成イラストをご確認いただきます。色味などの軽微な修正のみ対応可能です。",
    },
    {
      title: "納品",
      body: "問題がなければ、完成データを納品いたします！",
    },
  ],
  requests: [
    "ご依頼時は、できるだけ詳細な資料・イメージをご提示ください",
    "商用利用の有無を事前にお知らせください",
    "自作発言・AI学習は禁止しております",
    "大幅な修正はラフ段階でお願いいたします",
    "制作した作品は実績として掲載する場合があります（不可の場合は事前にご相談ください）",
  ],
  socialLinks: [
    { label: "X (Twitter)", href: "https://x.com/natonato_o" },
    { label: "つなぐ", href: "https://tsunagu.cloud/users/natonato_o" },
  ],
  copyright: "© 2026 Natori* illust. All rights reserved.",
};

/* ------------------------------------------------------------------
   SNSリンクの振り分け
   X はプロフィールアイコン直下、つなぐ はご依頼フォーム付近に表示するため、
   フッターにはそれ以外のリンクだけを残す
------------------------------------------------------------------- */
export function isPortfolioXLink(link: PortfolioSocialLink): boolean {
  return (
    link.href.includes("x.com") ||
    link.href.includes("twitter.com") ||
    /twitter|^x\b/i.test(link.label)
  );
}

export function isPortfolioTsunaguLink(link: PortfolioSocialLink): boolean {
  return link.href.includes("tsunagu") || link.label.includes("つなぐ");
}

/* ------------------------------------------------------------------
   プレースホルダーSVGの配色・カードの傾き（作品画像が未設定のとき用）
------------------------------------------------------------------- */
export const placeholderPalettes = [
  { skin: "#FFE3D1", hair: "#B98BD8", accent: c.pink },
  { skin: "#FFE9DA", hair: "#7FD9C4", accent: c.mint },
  { skin: "#FDE0D0", hair: "#F3A6C1", accent: c.peach },
  { skin: "#FFE3D1", hair: "#FFC15E", accent: c.yellow },
  { skin: "#FFE9DA", hair: "#9AB8F0", accent: c.mint },
  { skin: "#FDE0D0", hair: "#E893B0", accent: c.pink },
] as const;

export const workRotations = [
  "-rotate-3",
  "rotate-2",
  "rotate-1",
  "-rotate-2",
  "rotate-3",
  "-rotate-1",
] as const;

/** 料金プランの丸アイコン色（プラン数に応じて循環） */
export const planColors = [c.mint, c.pink, c.peach, c.yellow] as const;

/** マスキングテープの色（作品カードごとに循環） */
export const tapeColors = ["#FFE8A3", "#FFD3E2", "#CFF3E8", "#DCE4FF"] as const;

/* ------------------------------------------------------------------
   料金プラン → ご依頼フォームの連動
------------------------------------------------------------------- */
/** フォームの「サイズ / プラン」選択肢の表記。料金カードとフォームで共有する */
export function planChoiceLabel(plan: { name: string; price: string }): string {
  return `${plan.name}（${plan.price}）`;
}

/** 「このプランで相談」→ フォームのプラン自動選択に使うイベント名 */
export const PLAN_SELECT_EVENT = "natori-portfolio-select-plan";

/* ------------------------------------------------------------------
   フォームの選択肢（編集画面の対象外。変えたいときはここを編集）
------------------------------------------------------------------- */
export const portfolioBudgetOptions = [
  "〜5,000円",
  "5,000円〜10,000円",
  "10,000円〜20,000円",
  "20,000円以上",
  "未定・相談したい",
] as const;

export const portfolioDeadlineOptions = [
  "通常（約1ヶ月前後）",
  "お急ぎ納品を希望（+2,000円・要相談）",
] as const;
