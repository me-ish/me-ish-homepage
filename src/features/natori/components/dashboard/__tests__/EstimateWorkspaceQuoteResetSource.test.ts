import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    "src",
    "features",
    "natori",
    "components",
    "dashboard",
    "EstimateWorkspace.tsx",
  ),
  "utf8",
);

describe("EstimateWorkspace structured pricing source", () => {
  it("loads portfolio pricing and remounts the issue panel only when the project changes", () => {
    expect(source).toContain('fetch("/api/natori/portfolio/content", { cache: "no-store" })');
    expect(source).toContain("createPortfolioStructuredPricingConfig(portfolioContent)");
    expect(source).toContain('const PRICING_SOURCE_NAME = "ポートフォリオ公開料金"');
    expect(source).toContain("key={project.id}");
    expect(source).not.toContain("pricingRevision");
    expect(source).not.toContain("activePresetId");
  });
});
