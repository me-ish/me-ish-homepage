import { describe, expect, it } from "vitest";

import {
  NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
  applyPortfolioPlanSelection,
  createInitialPortfolioRequestFormState,
  isMassProductionIllustrationSelection,
} from "@/features/natori/lib/portfolioRequestForm";
import { NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL } from "@/features/natori/lib/requestPresentation";

describe("applyPortfolioPlanSelection", () => {
  it("通常プランCTAから見積りモードへ切り替えてプランを反映する", () => {
    const selected = applyPortfolioPlanSelection(
      createInitialPortfolioRequestFormState(),
      "full_body"
    );

    expect(selected).toMatchObject({
      inquiryMode: "quote",
      commissionScope: "full_body",
    });
  });

  it("料金セクションの量産イラストCTAから見積りモードの専用依頼状態へ切り替える", () => {
    const selected = applyPortfolioPlanSelection(
      createInitialPortfolioRequestFormState(),
      NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE
    );

    expect(selected).toMatchObject({
      inquiryMode: "quote",
      requestType: "other",
      requestTypeOther: NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL,
      commissionScope: "other",
      commissionScopeOther: "",
      commercialUse: "none",
    });
    expect(isMassProductionIllustrationSelection(selected)).toBe(true);
  });
});
