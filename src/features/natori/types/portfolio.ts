// features/natori/types/portfolio.ts
// /natori/portfolio (コミッション用ポートフォリオ) の表示・編集用型。
// 掲載内容一式は PortfolioContent に集約され、DB (natori_portfolio_content) に
// jsonb として保存される。DB行が無い/壊れている場合は defaultPortfolioContent を使う。

/**
 * ポートフォリオの表示バリアント。
 * - "full": /natori/portfolio。依頼フォーム・料金・SNSを含む通常表示
 * - "showcase": /natori/works。営業先プラットフォーム（つなぐ等）に提示する
 *   作品集専用表示。直接取引への誘導とみなされ得る導線
 *   （依頼フォーム・料金・受付状況・SNSリンク）を一切含めない
 */
export type PortfolioVariant = "full" | "showcase";

export type PortfolioCollection = {
  /** 表示名から独立した一意なID。並べ替え・作品との紐付けに使用 */
  id: string;
  name: string;
  /** コレクション見出しの補足。空文字なら非表示 */
  description: string;
  /** テープ・ジャンルバッジに使う淡色の6桁HEX */
  color: string;
};

export type PortfolioWork = {
  /** 一意なID（編集画面で生成。react key と並び替えに使用） */
  id: string;
  title: string;
  /** タグ（複数可。例: ["つなぐ", "立ち絵"]）。旧データの単一 tag はパース時に移行される */
  tags: string[];
  /** 画像URL（アップロード済みの公開URL）。null ならプレースホルダーSVGを表示 */
  image: string | null;
  /** 所属コレクション。null は「その他」として扱う */
  collectionId: string | null;
  /** コレクション先頭の代表3件へ優先表示する */
  featured: boolean;
  /** false の作品は保存したまま公開ギャラリーから外す */
  published: boolean;
};

export type PortfolioPlan = {
  /**
   * 表示名から独立した永続ID。ID導入前の未知legacy項目だけは null のまま保持し、
   * 既知項目へ推測で割り当てない。
   */
  id: string | null;
  name: string;
  price: string;
  desc: string;
  features: string[];
};

export type PortfolioOption = {
  /** PortfolioPlan.id と同じ互換方針。 */
  id: string | null;
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
  /** プロフィール欄（アイコン下）の名前。空ならサイト名 (artistName) と同じ表示 */
  profileName: string;
  /** プロフィール欄の肩書き。空ならヒーローの英字肩書き (roleEn) と同じ表示 */
  profileRole: string;
  /** Heroタイトルの前半（基本の文字色） */
  heroTitleAccent: string;
  /** Heroタイトルの後半（画材色で一文字ずつ彩る部分） */
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
  /** 作品をまとめる公開コレクション。配列順が公開ページの表示順 */
  collections: PortfolioCollection[];
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
