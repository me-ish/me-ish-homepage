import type { NatoriInquiryModeV1 } from "@/features/natori/types/request";

export const OPEN_PORTFOLIO_INQUIRY = "natori-portfolio-open-inquiry";
export const PORTFOLIO_INQUIRY_VISIBILITY = "natori-portfolio-inquiry-visibility";

export type PortfolioInquiryOpenDetail = {
  mode?: NatoriInquiryModeV1;
  fromPlan?: boolean;
};
