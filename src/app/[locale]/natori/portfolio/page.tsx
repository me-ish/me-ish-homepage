// app/natori/portfolio/page.tsx
// イラストレーター ナトリのコミッション用ポートフォリオ。
// 掲載内容は /natori/portfolio/edit の編集画面から変更でき、DBから読み込む。
// 既存の /natori (VGen向けページ) とは別物の独立ページ。
import type { Metadata } from "next";
import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";
import { loadPortfolioContent } from "@/features/natori/server/portfolioSiteService";
import { isPublicStructuredIntakeEnabled } from "@/features/natori/server/publicIntakeRollout";

export const dynamic = "force-dynamic";

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
