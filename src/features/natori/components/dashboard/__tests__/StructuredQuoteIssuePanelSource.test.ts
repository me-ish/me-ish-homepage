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
  it("unlocks only when the server explicitly returns a non-retryable client error", () => {
    expect(source).toContain("const responseIsExplicitlyNonRetryable =");
    expect(source).toContain(
      "json !== null && response.status < 500 && json.retryable !== true",
    );
    expect(source).toContain("if (responseIsExplicitlyNonRetryable)");
    expect(source).toContain("requestBodyRef.current = null");
    expect(source).toContain("setAttemptLocked(false)");
  });

  it("keeps the attempt for malformed or missing JSON and all 5xx responses", () => {
    expect(source).toContain("json !== null");
    expect(source).toContain("response.status < 500");
  });

  it("does not clear the frozen attempt in the generic catch path", () => {
    const catchBlock = source.match(/} catch \(cause\) \{[\s\S]*?\n    } finally/u)?.[0];
    expect(catchBlock).toBeTruthy();
    expect(catchBlock).not.toContain("requestBodyRef.current = null");
    expect(catchBlock).not.toContain("setAttemptLocked(false)");
  });
});
