// features/natori/types/portfolio.ts
// /natori/portfolio (コミッション用ポートフォリオ) の表示専用型

export type PortfolioArtwork = {
  id: number;
  title: string;
  tag: string;
  /** 作品画像のパス（/public 配下、例: "/natori/portfolio/work-01.png"）。null ならプレースホルダーSVGを表示 */
  image?: string | null;
  /** プレースホルダーSVG用の配色（実画像を設定したら使われない） */
  skin: string;
  hair: string;
  accent: string;
  /** Tailwind の rotate クラス（例: "-rotate-3"） */
  rotate: string;
};

export type PortfolioPlan = {
  name: string;
  price: string;
  desc: string;
  features: string[];
  color: string;
  badge: string | null;
};

export type PortfolioSocialLink = {
  label: string;
  href: string;
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
