import { describe, expect, it } from "vitest";

import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { preparePortfolioContentForSave } from "../portfolioContent";

describe("preparePortfolioContentForSave mass-production samples", () => {
  it("名前が空でもアップロード済み作例を暗黙削除しない", () => {
    const prepared = preparePortfolioContentForSave({
      ...defaultPortfolioContent,
      massProductionSamples: [
        {
          id: "sample-1",
          name: "   ",
          image: "https://example.com/sample.webp",
        },
      ],
    });

    expect(prepared?.massProductionSamples).toEqual([
      {
        id: "sample-1",
        name: "",
        image: "https://example.com/sample.webp",
      },
    ]);
  });
});
