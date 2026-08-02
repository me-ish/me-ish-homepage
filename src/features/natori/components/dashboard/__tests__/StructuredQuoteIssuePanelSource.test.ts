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
    "StructuredQuoteIssuePanel.tsx",
  ),
  "utf8",
);

describe("StructuredQuoteIssuePanel retry lock", () => {
  it("keeps the frozen attempt only for retryable server responses", () => {
    expect(source).toContain("if (json?.retryable !== true)");
    expect(source).toContain("requestBodyRef.current = null");
    expect(source).toContain("setAttemptLocked(false)");
  });

  it("does not clear the frozen attempt in the generic catch path", () => {
    const catchBlock = source.match(/} catch \(cause\) \{[\s\S]*?\n    } finally/u)?.[0];
    expect(catchBlock).toBeTruthy();
    expect(catchBlock).not.toContain("requestBodyRef.current = null");
    expect(catchBlock).not.toContain("setAttemptLocked(false)");
  });
});
