// features/natori/constants/portfolioContent.ts
// /natori/portfolio (コミッション用ポートフォリオ) のデフォルト掲載内容とデザイントークン。
//
// ★掲載内容の編集について
// 実際の掲載内容は /natori/portfolio/edit の編集画面からブラウザで変更でき、
// DB (natori_portfolio_content) に保存される。ここにあるのは「DBにまだ何も
// 保存されていないときの初期値」なので、コードで直す必要は基本的にない。
// 料金・自己紹介の初期値は つなぐ (https://tsunagu.cloud/users/natonato_o) がベース。

import type {
  PortfolioContent,
  PortfolioPlan,
  PortfolioSocialLink,
} from "@/features/natori/types/portfolio";

/* ------------------------------------------------------------------
   カラートークン
   ここを書き換えるだけで全体の配色を調整できます
------------------------------------------------------------------- */
/** プールサイドの参考配色を基準に、ピンクと水色を土台、オレンジを主アクセントにする。 */
export const portfolioColors = {
  page: "#FFF9F8",
  surface: "#FFFFFF",
  surfaceSubtle: "#FFF1F2",
  text: "#456579",
  textSoft: "#4F7188",
  borderSubtle: "#F2AEB4",
  borderStrong: "#6F91AD",
  accent: "#F29E38",
  accentDisplay: "#D87814",
  accentText: "#AC5900",
  accentHover: "#26AFCA",
  accentSoft: "#FFF0D8",
  action: "#F29E38",
  onAction: "#27465B",
  onError: "#FFFFFF",
  error: "#B42318",
  errorSoft: "#FEF3F2",
  success: "#26798F",
  successSoft: "#E8FAFC",
  overlay: "rgba(39,70,91,0.68)",
  pageTranslucent: "rgba(255,249,248,0.94)",
  shadowSoft: "rgba(111,145,173,0.14)",
  shadowHover: "rgba(111,145,173,0.22)",
  shadowFloating: "rgba(74,110,137,0.28)",
} as const;

/** Heroの「あ・と・り・え」を、暖色から寒色へ自然につながる虹色で彩る。 */
export const portfolioHeroTitleColors = [
  "#FF9B73",
  "#FFD85A",
  "#7ED9A3",
  "#73C7FF",
] as const;

/**
 * 作品未設定時のプレースホルダーと既存装飾に限る一時 palette。
 * UI状態や本文には使わず、tape/rotation/tagの整理と合わせてPF-04/05で縮小する。
 */
export const portfolioDecorativeColors = {
  sparkleWarm: "#F29E38",
  sparkleCool: "#26AFCA",
  placeholderRose: "#F2AEB4",
  placeholderMint: "#59CCD9",
  placeholderPeach: "#F6C48C",
  placeholderGold: "#F4C95D",
} as const;

/**
 * Quote/delivery画面が従来借用していた配色の互換境界。
 * PF-02は公開portfolioだけを対象とするため、取引画面の見た目を変えずに依存を分離する。
 * 新しいportfolio componentからは参照しない。
 */
export const legacyNatoriTransactionColors = {
  paper: "#F7F3FB",
  paperAlt: "#EFE7F7",
  ink: "#2D2A3D",
  inkSoft: "#5B5670",
  pink: "#FF6FA5",
  pinkDeep: "#E84C86",
  peach: "#FFB199",
  card: "#FFFFFF",
} as const;

const c = portfolioColors;

/* ------------------------------------------------------------------
   料金・依頼contractと共有するstable ID

   Phase 0の正式設計に合わせ、IDはlower ASCIIのsnake_caseを採用する。
   labelや配列位置から新規生成せず、既知legacy labelだけを完全一致で補完する。
------------------------------------------------------------------- */
export const PORTFOLIO_PLAN_IDS = {
  sd: "sd",
  bustUp: "bust_up",
  waistUp: "waist_up",
  fullBody: "full_body",
} as const;

export const PORTFOLIO_OPTION_IDS = {
  complexProp: "complex_prop",
  mascotProp: "mascot_prop",
  expressionVariation: "expression_variation",
  additionalCharacter: "additional_character",
  detailedBackground: "detailed_background",
  commercialUse: "commercial_use",
  sampleUsageDenied: "sample_usage_denied",
  privateWork: "private_work",
} as const;

export const LEGACY_PORTFOLIO_PLAN_ID_BY_EXACT_NAME: Readonly<Record<string, string>> = {
  "SDキャラ": PORTFOLIO_PLAN_IDS.sd,
  胸上: PORTFOLIO_PLAN_IDS.bustUp,
  "膝〜腰上": PORTFOLIO_PLAN_IDS.waistUp,
  全身: PORTFOLIO_PLAN_IDS.fullBody,
};

export const LEGACY_PORTFOLIO_OPTION_ID_BY_EXACT_NAME: Readonly<Record<string, string>> = {
  複雑な小物追加: PORTFOLIO_OPTION_IDS.complexProp,
  "ぬいぐるみ / マスコット追加": PORTFOLIO_OPTION_IDS.mascotProp,
  表情差分: PORTFOLIO_OPTION_IDS.expressionVariation,
  人物追加: PORTFOLIO_OPTION_IDS.additionalCharacter,
  しっかり背景: PORTFOLIO_OPTION_IDS.detailedBackground,
  商用利用: PORTFOLIO_OPTION_IDS.commercialUse,
  サンプル使用不可: PORTFOLIO_OPTION_IDS.sampleUsageDenied,
  完全非公開: PORTFOLIO_OPTION_IDS.privateWork,
};

/* ------------------------------------------------------------------
   デフォルト掲載内容（DB未保存時の初期値）
------------------------------------------------------------------- */
export const defaultPortfolioContent: PortfolioContent = {
  commissionOpen: true,
  artistName: "Natori* illust",
  roleEn: "Cute Anime Illustrator",
  profileName: "ナトリ",
  profileRole: "Illustrator",
  heroTitleAccent: "ナトリの",
  heroTitleTail: "あとりえ",
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
  collections: [
    { id: "illustration", name: "一枚絵", description: "", color: "#FFD6E5" },
    { id: "icon", name: "アイコン", description: "", color: "#D9F3EE" },
    { id: "standing", name: "立ち絵", description: "", color: "#E8DDF7" },
  ],
  works: [
    { id: "work-1", title: "夏色スケッチ", tags: [], image: null, collectionId: "illustration", featured: true, published: true },
    { id: "work-2", title: "おひるねちゃん", tags: [], image: null, collectionId: "icon", featured: true, published: true },
    { id: "work-3", title: "制服ver.", tags: [], image: null, collectionId: "standing", featured: true, published: true },
    { id: "work-4", title: "推し色コーデ", tags: [], image: null, collectionId: "illustration", featured: true, published: true },
    { id: "work-5", title: "ふわもこパーカー", tags: [], image: null, collectionId: "icon", featured: true, published: true },
    { id: "work-6", title: "きらきら配信衣装", tags: [], image: null, collectionId: "standing", featured: true, published: true },
  ],
  plans: [
    {
      id: PORTFOLIO_PLAN_IDS.sd,
      name: "SDキャラ",
      price: "3,000円",
      desc: "SDフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
    {
      id: PORTFOLIO_PLAN_IDS.bustUp,
      name: "胸上",
      price: "4,000円",
      desc: "胸から上のフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
    {
      id: PORTFOLIO_PLAN_IDS.waistUp,
      name: "膝〜腰上",
      price: "6,000円",
      desc: "膝〜腰上までのフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
    {
      id: PORTFOLIO_PLAN_IDS.fullBody,
      name: "全身",
      price: "10,000円",
      desc: "全身のフルカラーイラスト",
      features: ["リテイク2回まで無料", "簡単な小物・簡易背景無料"],
    },
  ],
  options: [
    { id: PORTFOLIO_OPTION_IDS.complexProp, name: "複雑な小物追加", price: "+500円" },
    {
      id: PORTFOLIO_OPTION_IDS.mascotProp,
      name: "ぬいぐるみ / マスコット追加",
      price: "+500円",
    },
    { id: PORTFOLIO_OPTION_IDS.expressionVariation, name: "表情差分", price: "+500円" },
    {
      id: PORTFOLIO_OPTION_IDS.additionalCharacter,
      name: "人物追加",
      price: "基本料金の+70%",
    },
    {
      id: PORTFOLIO_OPTION_IDS.detailedBackground,
      name: "しっかり背景",
      price: "+3,000円〜5,000円",
    },
    { id: PORTFOLIO_OPTION_IDS.commercialUse, name: "商用利用", price: "+3,000円" },
    {
      id: PORTFOLIO_OPTION_IDS.sampleUsageDenied,
      name: "サンプル使用不可",
      price: "+1,000円",
    },
    { id: PORTFOLIO_OPTION_IDS.privateWork, name: "完全非公開", price: "+2,000円" },
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
  { skin: "#FFE3D1", hair: "#B98BD8", accent: portfolioDecorativeColors.placeholderRose },
  { skin: "#FFE9DA", hair: "#7FD9C4", accent: portfolioDecorativeColors.placeholderMint },
  { skin: "#FDE0D0", hair: "#F3A6C1", accent: portfolioDecorativeColors.placeholderPeach },
  { skin: "#FFE3D1", hair: "#FFC15E", accent: portfolioDecorativeColors.placeholderGold },
  { skin: "#FFE9DA", hair: "#9AB8F0", accent: portfolioDecorativeColors.placeholderMint },
  { skin: "#FDE0D0", hair: "#E893B0", accent: portfolioDecorativeColors.placeholderRose },
] as const;

export const workRotations = [
  "-rotate-3",
  "rotate-2",
  "rotate-1",
  "-rotate-2",
  "rotate-3",
  "-rotate-1",
] as const;

/** 作品カードの既存装飾。作品を主役にするPF-04でtape自体を含めて削減予定。 */
export const tapeColors = ["#FFE8A3", "#FFD3E2", "#CFF3E8", "#DCE4FF"] as const;

/* ------------------------------------------------------------------
   料金プラン → ご依頼フォームの連動
------------------------------------------------------------------- */
/** フォームの「サイズ / プラン」選択肢の表記。料金カードとフォームで共有する */
export function planChoiceLabel(plan: { name: string; price: string }): string {
  return `${plan.name}（${plan.price}）`;
}

export type PortfolioPlanSelectDetail = {
  /** null はID導入前の未知legacy planだけ。 */
  id: string | null;
  label: string;
};

export function portfolioPlanSelectDetail(plan: PortfolioPlan): PortfolioPlanSelectDetail {
  return { id: plan.id, label: planChoiceLabel(plan) };
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
