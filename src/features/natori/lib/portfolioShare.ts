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

/** 共有カードの大見出し。分けて登録された呼び名は2色で出し、どちらも空ならサイト名（artistName）をそのまま出す。 */
export function portfolioShareTitle(
  content: Pick<PortfolioContent, "heroTitleAccent" | "heroTitleTail" | "artistName">,
): { accent: string; tail: string } {
  const accent = content.heroTitleAccent.trim();
  const tail = content.heroTitleTail.trim();
  if (accent || tail) return { accent, tail };
  return { accent: content.artistName.trim(), tail: "" };
}

/**
 * 共有カードに使う画像の取得先。https の URL のほか、「/」で始まる同じサイト内のパスは siteUrl を基準に解決する。
 * http は開発中（allowHttp）だけ許可し、それ以外のスキームや解釈できない値は null。
 */
export function resolvePortfolioShareImageUrl(url: string, siteUrl: string, allowHttp: boolean): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    try {
      parsed = new URL(url, siteUrl);
    } catch {
      return null;
    }
  }
  return parsed.protocol === "https:" || (allowHttp && parsed.protocol === "http:") ? parsed : null;
}

/** 共有カードに出す作品。スライドの1枚目、なければ公開中で画像のある最初の作品。 */
export function portfolioShareArtwork(
  content: Pick<PortfolioContent, "heroImages" | "heroImage" | "works">,
): string | null {
  const slide = (content.heroImages ?? []).find((image) => Boolean(image)) ?? content.heroImage;
  if (slide) return slide;
  return content.works.find((work) => work.published && Boolean(work.image))?.image ?? null;
}
