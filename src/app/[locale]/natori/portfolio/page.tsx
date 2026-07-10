// app/natori/portfolio/page.tsx
// イラストレーター ナトリのコミッション用ポートフォリオ。
// 既存の /natori (VGen向けページ) とは別物の独立ページ。
import type { Metadata } from "next";
import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";

const title = "Natori* illust – Commission Portfolio";
const description =
  "淡いピンクや水色を基調とした、やわらかく可愛い女の子のイラストのコミッションポートフォリオ。作品ギャラリー・料金・ご依頼フォーム。";
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
