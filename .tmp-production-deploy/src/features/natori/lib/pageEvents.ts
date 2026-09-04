export const NATORI_PAGE_EVENT_NAMES = [
  "links_click",
  "portfolio_sns_click",
  "portfolio_plan_click",
  "portfolio_primary_cta_click",
  "portfolio_gallery_open",
  "portfolio_form_start",
  "portfolio_form_mode_select",
  "portfolio_form_submit",
] as const;

export type NatoriPageEventName = (typeof NATORI_PAGE_EVENT_NAMES)[number];

export const NATORI_PAGE_EVENT_LABEL_MAX_LENGTH = 100;

/** 公開済みの作品情報だけで、ギャラリー閲覧イベントのラベルを作る。 */
export function portfolioGalleryEventLabel(collectionName: string, workTitle: string): string {
  const publicParts = [collectionName.trim(), workTitle.trim()].filter(Boolean);
  return (publicParts.join(" / ") || "work").slice(0, NATORI_PAGE_EVENT_LABEL_MAX_LENGTH);
}
