import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { portfolioPlanSample } from "@/features/natori/lib/portfolioPlanSamples";
import type { PortfolioWork } from "@/features/natori/types/portfolio";

const base = defaultPortfolioContent.works[0];
const works: PortfolioWork[] = [
  { ...base, id: "shown", title: "公開中", image: "https://example.com/shown.webp", published: true },
  { ...base, id: "hidden", title: "非公開", image: "https://example.com/hidden.webp", published: false },
  { ...base, id: "noimage", title: "画像なし", image: null, published: true },
];

describe("portfolioPlanSample", () => {
  it("uses the chosen work when it is published and has an image", () => {
    expect(portfolioPlanSample({ sampleWorkId: "shown" }, works)).toEqual({
      title: "公開中",
      image: "https://example.com/shown.webp",
    });
  });

  it("shows nothing for unset, unpublished, imageless or deleted works", () => {
    expect(portfolioPlanSample({}, works)).toBeNull();
    expect(portfolioPlanSample({ sampleWorkId: null }, works)).toBeNull();
    expect(portfolioPlanSample({ sampleWorkId: "hidden" }, works)).toBeNull();
    expect(portfolioPlanSample({ sampleWorkId: "noimage" }, works)).toBeNull();
    expect(portfolioPlanSample({ sampleWorkId: "deleted" }, works)).toBeNull();
  });
});
