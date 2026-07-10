// features/natori/constants/portfolioContent.ts
// /natori/portfolio (コミッション用ポートフォリオ) の掲載内容
// 名前・作品・料金・オプション・SNSリンクはすべてここに集約。差し替えはこのファイルだけでOK。
// 料金・自己紹介は つなぐ (https://tsunagu.cloud/users/natonato_o) の掲載内容がベース。

import type {
  PortfolioArtwork,
  PortfolioDeliveryNote,
  PortfolioOption,
  PortfolioPlan,
  PortfolioSocialLink,
  PortfolioWorkflowStep,
} from "@/features/natori/types/portfolio";

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

/** コミッション受付中 / 停止中はここを切り替え */
export const commissionOpen = true;

/* ------------------------------------------------------------------
   プロフィール
------------------------------------------------------------------- */
export const portfolioProfile = {
  artistName: "Natori* illust",
  roleEn: "Cute Anime Illustrator",
  heroTitleAccent: "ナトリ",
  heroTitleTail: "のポートフォリオへようこそ",
  heroDescription:
    "淡いピンクや水色を基調とした、やわらかく可愛い女の子のイラストを描いています。アニメ塗りをベースに、シンプルながらも印象に残る表現を心がけています。",
  aboutParagraphs: [
    "淡いピンクや水色を基調とした、やわらかく可愛い女の子のイラストを描いています。アニメ塗りをベースに、シンプルながらも印象に残る表現を心がけています。",
    "アイコン・一枚絵・創作キャラクターなどのご依頼を中心にお受けしています。ご希望の雰囲気やこだわりにも丁寧に寄り添い、一枚一枚大切に制作いたします。",
    "「かわいい」「きゅんとする」イラストをお求めの方は、ぜひお気軽にご相談ください。",
  ],
  copyright: "© 2026 Natori* illust. All illustrations placeholder.",
} as const;

/* ------------------------------------------------------------------
   画像の差し替え
   画像ファイルを public/natori/portfolio/ に置いて、ここにパスを書くだけでOK。
   null のままだとプレースホルダーSVG（ちびキャラ）が表示される。
------------------------------------------------------------------- */
export const portfolioImages = {
  /** トップ(ヒーロー)の丸枠に入るメインビジュアル。例: "/natori/portfolio/hero.png" */
  hero: null as string | null,
  /** プロフィール欄の丸アイコン。例: "/natori/portfolio/icon.png" */
  about: null as string | null,
};

/** 対応内容（Aboutのチップ・フォームのご依頼内容の選択肢） */
export const portfolioServices = [
  "SNSアイコン",
  "配信用立ち絵",
  "オリジナルキャラクター",
  "TRPG立ち絵",
  "動画サムネイル",
  "一枚絵",
] as const;

/* ------------------------------------------------------------------
   作品ギャラリー（プレースホルダー。実画像への差し替え前提）
------------------------------------------------------------------- */
export const portfolioGalleryFilters = [
  "すべて",
  "アイコン",
  "立ち絵",
  "一枚絵",
] as const;

export const portfolioArtworks: PortfolioArtwork[] = [
  { id: 1, title: "夏色スケッチ", tag: "一枚絵", skin: "#FFE3D1", hair: "#B98BD8", accent: c.pink, rotate: "-rotate-3" },
  { id: 2, title: "おひるねちゃん", tag: "アイコン", skin: "#FFE9DA", hair: "#7FD9C4", accent: c.mint, rotate: "rotate-2" },
  { id: 3, title: "制服ver.", tag: "立ち絵", skin: "#FDE0D0", hair: "#F3A6C1", accent: c.peach, rotate: "rotate-1" },
  { id: 4, title: "推し色コーデ", tag: "一枚絵", skin: "#FFE3D1", hair: "#FFC15E", accent: c.yellow, rotate: "-rotate-2" },
  { id: 5, title: "ふわもこパーカー", tag: "アイコン", skin: "#FFE9DA", hair: "#9AB8F0", accent: c.mint, rotate: "rotate-3" },
  { id: 6, title: "きらきら配信衣装", tag: "立ち絵", skin: "#FDE0D0", hair: "#E893B0", accent: c.pink, rotate: "-rotate-1" },
];

/* ------------------------------------------------------------------
   基本料金
------------------------------------------------------------------- */
export const portfolioPlans: PortfolioPlan[] = [
  {
    name: "胸上",
    price: "4,000円",
    desc: "胸から上のフルカラーイラスト",
    features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    color: c.mint,
    badge: null,
  },
  {
    name: "膝〜腰上",
    price: "6,000円",
    desc: "膝〜腰上までのフルカラーイラスト",
    features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    color: c.pink,
    badge: null,
  },
  {
    name: "全身",
    price: "10,000円",
    desc: "全身のフルカラーイラスト",
    features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    color: c.peach,
    badge: null,
  },
];

/* ------------------------------------------------------------------
   追加オプション
------------------------------------------------------------------- */
export const portfolioOptions: PortfolioOption[] = [
  { name: "複雑な小物追加", price: "+500円" },
  { name: "ぬいぐるみ / マスコット追加", price: "+500円" },
  { name: "表情差分", price: "+500円" },
  { name: "人物追加", price: "基本料金の+70%" },
  { name: "しっかり背景", price: "+3,000円〜5,000円" },
  { name: "商用利用", price: "+3,000円" },
  { name: "サンプル使用不可", price: "+1,000円" },
  { name: "完全非公開", price: "+2,000円" },
  { name: "お急ぎ納品", price: "+2,000円" },
  { name: "リテイク3回目以降", price: "+500円 / 回" },
];

/* ------------------------------------------------------------------
   納期について
------------------------------------------------------------------- */
export const portfolioDeliveryLead =
  "通常納期は、ご依頼確定後から約1ヶ月前後を目安としております。ご依頼内容やスケジュール状況によって前後する場合がございますので、あらかじめご了承ください。";

export const portfolioDeliveryNotes: PortfolioDeliveryNote[] = [
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
];

/* ------------------------------------------------------------------
   制作の流れ
------------------------------------------------------------------- */
export const portfolioWorkflow: PortfolioWorkflowStep[] = [
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
];

/* ------------------------------------------------------------------
   購入者へのお願い
------------------------------------------------------------------- */
export const portfolioRequests = [
  "ご依頼時は、できるだけ詳細な資料・イメージをご提示ください",
  "商用利用の有無を事前にお知らせください",
  "自作発言・AI学習は禁止しております",
  "大幅な修正はラフ段階でお願いいたします",
  "制作した作品は実績として掲載する場合があります（不可の場合は事前にご相談ください）",
] as const;

/* ------------------------------------------------------------------
   フォームの選択肢
------------------------------------------------------------------- */
export const portfolioBudgetOptions = [
  "〜5,000円",
  "5,000円〜10,000円",
  "10,000円〜20,000円",
  "20,000円以上",
  "未定・相談したい",
] as const;

export const portfolioCommercialOptions = [
  "なし（個人利用）",
  "あり（商用利用オプション +3,000円）",
  "未定・相談したい",
] as const;

export const portfolioDeadlineOptions = [
  "通常（約1ヶ月前後）",
  "お急ぎ納品を希望（+2,000円・要相談）",
] as const;

/* ------------------------------------------------------------------
   SNSリンク（ダミー。公開前に差し替え）
------------------------------------------------------------------- */
export const portfolioSocialLinks: PortfolioSocialLink[] = [
  { label: "X (Twitter)", href: "#" },
  { label: "つなぐ", href: "https://tsunagu.cloud/users/natonato_o" },
  { label: "VGen", href: "#" },
];
