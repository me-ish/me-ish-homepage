import { describe, expect, it } from "vitest";
import { caseInsightsUpdate, closeReasonNote } from "../caseInsights";
import { caseAdminAction } from "../caseAdministration";

const projectId = "a0000000-0000-4000-8000-000000000001";

describe("caseInsights", () => {
  it("builds the close note from the chosen reason and an optional memo", () => {
    expect(closeReasonNote("budget", "")).toBe("予算が合わない");
    expect(closeReasonNote("other", "  時期を改める  ")).toBe("その他：時期を改める");
  });

  it("accepts only known choices", () => {
    expect(caseInsightsUpdate.safeParse({ projectId, patch: { source: "pixiv" } }).success).toBe(true);
    expect(caseInsightsUpdate.safeParse({ projectId, patch: { repeatClient: true, closeReason: null } }).success).toBe(true);
    expect(caseInsightsUpdate.safeParse({ projectId, patch: { source: "friend" } }).success).toBe(false);
    expect(caseInsightsUpdate.safeParse({ projectId, patch: {} }).success).toBe(false);
    expect(caseInsightsUpdate.safeParse({ projectId, patch: { source: "x" }, clientName: "x" }).success).toBe(false);
  });

  it("lets the close command carry a chosen reason and still accepts the old shape", () => {
    expect(caseAdminAction.safeParse({ command: "close", reason: "予算が合わない", reasonKind: "budget" }).success).toBe(true);
    expect(caseAdminAction.safeParse({ command: "close", reason: "自由記入だけ" }).success).toBe(true);
    expect(caseAdminAction.safeParse({ command: "close", reason: "x", reasonKind: "mood" }).success).toBe(false);
  });
});
