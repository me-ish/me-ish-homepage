// app/og/natori-portfolio.png/route.ts
// /natori/portfolio の共有カード画像。掲載内容（スライド・アイコン・受付状況）から毎回作る。
// [locale] 配下の opengraph-image だと URL に既定ロケールが入りリダイレクトされるため、
// 拡張子付きの固定パス（ミドルウェア対象外）で配信する。
import { loadPortfolioContent } from "@/features/natori/server/portfolioSiteService";
import { renderPortfolioShareImage } from "@/features/natori/server/portfolioShareImage";

export const dynamic = "force-dynamic";

export async function GET() {
  return renderPortfolioShareImage(await loadPortfolioContent());
}
