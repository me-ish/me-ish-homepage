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

describe("EstimateWorkspace structured quote draft reset", () => {
  it("remounts the issue panel for another project or pricing revision", () => {
    expect(source).toContain("const [pricingRevision, setPricingRevision] = useState(0)");
    expect(source).toContain("setPricingRevision((current) => current + 1)");
    expect(source).toContain(
      'key={`${project.id}:${activePresetId ?? "none"}:${pricingRevision}`}',
    );
  });
});
