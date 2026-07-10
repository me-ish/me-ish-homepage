// features/natori/types/portfolio.ts
// /natori/portfolio (コミッション用ポートフォリオ) の表示専用型

export type PortfolioArtwork = {
  id: number;
  title: string;
  tag: string;
  /** プレースホルダーSVG用の配色（実画像に差し替えたら不要になる想定） */
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
