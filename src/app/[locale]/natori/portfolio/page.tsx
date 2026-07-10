// app/natori/portfolio/page.tsx
// chibi・アニメ調イラストレーターのコミッション用ポートフォリオ。
// 既存の /natori (VGen向けページ) とは別物の独立ページ。
import type { Metadata } from "next";
import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";

const title = "Yukino* illust – Commission Portfolio";
const description =
  "chibi・アニメ調イラストのコミッションポートフォリオ。作品ギャラリー・料金・ご依頼フォーム。Live2D対応のレイヤー分け納品も相談可能。";
const siteUrl = "https://www.me-ish.art/natori/portfolio";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function Page() {
  return <PortfolioLanding />;
}
