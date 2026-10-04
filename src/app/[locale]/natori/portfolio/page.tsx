// app/natori/portfolio/page.tsx
// イラストレーター ナトリのコミッション用ポートフォリオ。
// 掲載内容は /natori/portfolio/edit の編集画面から変更でき、DBから読み込む。
// 既存の /natori (VGen向けページ) とは別物の独立ページ。
import type { Metadata } from "next";
import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";
import { loadPortfolioContent } from "@/features/natori/server/portfolioSiteService";
import { isPublicStructuredIntakeEnabled } from "@/features/natori/server/publicIntakeRollout";

export const dynamic = "force-dynamic";

// 呼び名はヘッダー・見出し・共有画像と同じ「ナトリのあとりえ」にそろえる。
// 共有画像は /og/natori-portfolio.png（app/og/natori-portfolio.png/route.ts）が掲載内容から作る。
const title = "ナトリのあとりえ｜イラストのご依頼";
const description =
  "イラストレーター・ナトリのご依頼ページ。淡いピンクや水色を基調とした、表情ゆたかな女の子のイラストのご依頼実績・料金・ご相談フォーム。";
const siteUrl = "https://www.me-ish.art/natori/portfolio";
const shareImage = { url: "/og/natori-portfolio.png", width: 1200, height: 630, alt: title, type: "image/png" };

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "ナトリのあとりえ",
    type: "website",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [shareImage],
  },
};

export default async function Page() {
  const content = await loadPortfolioContent();
  // 既定は無効。NATORI_PUBLIC_INTAKE_V2=1 を設定した環境だけ構造化受付になる。
  return (
    <PortfolioLanding
      content={content}
      structuredIntake={isPublicStructuredIntakeEnabled()}
    />
  );
}
