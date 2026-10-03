import type { PortfolioContent } from "./portfolio";

/** Validated read-view provenance only; never part of the persisted content schema. */
export type PortfolioDisplayContent = PortfolioContent & {
  workflowProjectionAllowed?: boolean;
};
