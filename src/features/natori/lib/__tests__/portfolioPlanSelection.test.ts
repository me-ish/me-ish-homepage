import { describe, expect, it } from "vitest";

import {
  NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
  applyPortfolioPlanSelection,
  createInitialPortfolioRequestFormState,
  isMassProductionIllustrationSelection,
} from "@/features/natori/lib/portfolioRequestForm";
import { NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL } from "@/features/natori/lib/requestPresentation";

describe("applyPortfolioPlanSelection", () => {
  it("料金セクションの量産イラストCTAから専用依頼状態へ切り替える", () => {
    const selected = applyPortfolioPlanSelection(
      createInitialPortfolioRequestFormState(),
      NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE
    );

    expect(selected).toMatchObject({
      requestType: "other",
      requestTypeOther: NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL,
      commissionScope: "other",
      commissionScopeOther: "",
      commercialUse: "none",
    });
    expect(isMassProductionIllustrationSelection(selected)).toBe(true);
  });
});
