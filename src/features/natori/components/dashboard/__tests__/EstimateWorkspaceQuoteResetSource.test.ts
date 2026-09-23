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

describe("EstimateWorkspace estimate journey", () => {
  it("loads the project and delegates both portfolio and external requests to the same workflow", () => {
    expect(source).toContain('fetch("/api/natori/portfolio/content", { cache: "no-store" })');
    expect(source).toContain("<EstimateJourney project={project} portfolioContent={portfolioContent} />");
    expect(source).toContain("<ExternalInquiryStarter />");
    expect(source).not.toContain("<StructuredQuoteIssuePanel");
    expect(source).not.toContain("pricingRevision");
    expect(source).not.toContain("activePresetId");
  });
});
