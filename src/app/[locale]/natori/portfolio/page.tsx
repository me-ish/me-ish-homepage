// app/natori/portfolio/page.tsx
// SDキャラ・アニメ調イラストレーターのコミッション用ポートフォリオ。
// 既存の /natori (VGen向けページ) とは別物の独立ページ。
import type { Metadata } from "next";
import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";

const title = "Natori* illust – Commission Portfolio";
const description =
  "SDキャラ・アニメ調イラストのコミッションポートフォリオ。作品ギャラリー・料金・ご依頼フォーム。";
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
