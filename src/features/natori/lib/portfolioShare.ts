// features/natori/lib/portfolioShare.ts
// 公開ポートフォリオの「呼び名」と、共有画像に使う作品を決める純関数。
// ヘッダー・タブのタイトル・共有画像で同じ名前を使うためにここへ集約する。
import type { PortfolioContent } from "@/features/natori/types/portfolio";

/** タブと共有カードのタイトルに付ける、ページの用件。 */
export const PORTFOLIO_PAGE_PURPOSE = "イラストのご依頼";

/** 見出しの「ナトリの」「あとりえ」をつないだ呼び名。未設定ならヘッダー用のサイト名を使う。 */
export function portfolioBrandName(
  content: Pick<PortfolioContent, "heroTitleAccent" | "heroTitleTail" | "artistName">,
): string {
  const brand = `${content.heroTitleAccent}${content.heroTitleTail}`.trim();
  return brand || content.artistName.trim();
}

/** 呼び名と別の表記（英字のサイト名など）があるときだけ、補助の表記として返す。 */
export function portfolioBrandSubName(
  content: Pick<PortfolioContent, "heroTitleAccent" | "heroTitleTail" | "artistName">,
): string | null {
  const sub = content.artistName.trim();
  return sub && sub !== portfolioBrandName(content) ? sub : null;
}

/** 共有カードに出す作品。スライドの1枚目、なければ公開中で画像のある最初の作品。 */
export function portfolioShareArtwork(
  content: Pick<PortfolioContent, "heroImages" | "heroImage" | "works">,
): string | null {
  const slide = (content.heroImages ?? []).find((image) => Boolean(image)) ?? content.heroImage;
  if (slide) return slide;
  return content.works.find((work) => work.published && Boolean(work.image))?.image ?? null;
}
