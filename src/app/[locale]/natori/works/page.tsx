// app/natori/works/page.tsx
// 営業先プラットフォーム（つなぐ等）に提示する作品集専用ページ。
// /natori/portfolio と同じ DB コンテンツを showcase 表示で描画し、
// 直接取引への誘導とみなされ得る導線（依頼フォーム・料金・SNS）を含めない。
// 営業時に URL を渡す用途専用のため検索エンジンにも載せない (noindex)。
import type { Metadata } from "next";
import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";
import { loadPortfolioContent } from "@/features/natori/server/portfolioSiteService";

export const dynamic = "force-dynamic";

const title = "Natori* illust – Works";
const description =
  "淡いピンクや水色を基調とした、やわらかく可愛い女の子のイラストの作品集。";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title,
    description,
    url: "https://www.me-ish.art/natori/works",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default async function Page() {
  const content = await loadPortfolioContent();
  return <PortfolioLanding content={content} variant="showcase" />;
}
