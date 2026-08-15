import { describe, expect, it } from "vitest";

import {
  NATORI_PAGE_EVENT_NAMES,
  portfolioGalleryEventLabel,
} from "@/features/natori/lib/pageEvents";

describe("natori page event definitions", () => {
  it("keeps one unique canonical event list for client and server", () => {
    expect(NATORI_PAGE_EVENT_NAMES).toEqual([
      "links_click",
      "portfolio_sns_click",
      "portfolio_plan_click",
      "portfolio_primary_cta_click",
      "portfolio_gallery_open",
      "portfolio_form_start",
      "portfolio_form_mode_select",
      "portfolio_form_submit",
    ]);
    expect(new Set(NATORI_PAGE_EVENT_NAMES).size).toBe(NATORI_PAGE_EVENT_NAMES.length);
  });

  it("builds a bounded gallery label from public collection and work names", () => {
    expect(portfolioGalleryEventLabel("SDキャラ", "作品1")).toBe("SDキャラ / 作品1");
    expect(portfolioGalleryEventLabel("collection", "x".repeat(200))).toHaveLength(100);
  });
});
