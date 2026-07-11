// features/natori/types/portfolio.ts
// /natori/portfolio (コミッション用ポートフォリオ) の表示・編集用型。
// 掲載内容一式は PortfolioContent に集約され、DB (natori_portfolio_content) に
// jsonb として保存される。DB行が無い/壊れている場合は defaultPortfolioContent を使う。

export type PortfolioWork = {
  /** 一意なID（編集画面で生成。react key と並び替えに使用） */
  id: string;
  title: string;
  /** タグ（複数可。例: ["つなぐ", "立ち絵"]）。旧データの単一 tag はパース時に移行される */
  tags: string[];
  /** 画像URL（アップロード済みの公開URL）。null ならプレースホルダーSVGを表示 */
  image: string | null;
};

export type PortfolioPlan = {
  name: string;
  price: string;
  desc: string;
  features: string[];
};

export type PortfolioOption = {
  name: string;
  price: string;
};

export type PortfolioDeliveryNote = {
  title: string;
  body: string;
};

export type PortfolioWorkflowStep = {
  title: string;
  body: string;
};

export type PortfolioSocialLink = {
  label: string;
  href: string;
};

export type PortfolioContent = {
  /** コミッション受付中かどうか */
  commissionOpen: boolean;
  /** ヘッダーのサイト名 */
  artistName: string;
  /** ヒーローの英字肩書き */
  roleEn: string;
  /** キャッチコピー（色付き部分） */
  heroTitleAccent: string;
  /** キャッチコピー（続き） */
  heroTitleTail: string;
  /** ヒーローの紹介文 */
  heroDescription: string;
  /** トップのメインビジュアル画像URL。null ならプレースホルダー */
  heroImage: string | null;
  /** プロフィールアイコン画像URL。null ならプレースホルダー */
  aboutImage: string | null;
  /** プロフィール文（1要素=1段落） */
  aboutParagraphs: string[];
  /** 対応内容のバッジ */
  services: string[];
  /** 作品ギャラリー */
  works: PortfolioWork[];
  /** 基本料金プラン */
  plans: PortfolioPlan[];
  /** 追加オプション */
  options: PortfolioOption[];
  /** 納期についての説明文 */
  deliveryLead: string;
  /** 納期の補足（お急ぎ納品など） */
  deliveryNotes: PortfolioDeliveryNote[];
  /** 制作の流れ */
  workflow: PortfolioWorkflowStep[];
  /** 購入者へのお願い */
  requests: string[];
  /** フッターのSNSリンク */
  socialLinks: PortfolioSocialLink[];
  /** フッターのコピーライト表記 */
  copyright: string;
};
