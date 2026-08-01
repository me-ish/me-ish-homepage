import { describe, expect, it } from "vitest";
import { resolveEstimateWorkspaceMode } from "@/features/natori/lib/estimateWorkspaceMode";

describe("resolveEstimateWorkspaceMode", () => {
  it("keeps the manual estimate tool when no inquiry is selected", () => {
    expect(resolveEstimateWorkspaceMode({ inquiryId: null, projectFound: false, hasRequestData: false })).toBe("manual");
  });

  it("returns not-found for an unknown deep link", () => {
    expect(resolveEstimateWorkspaceMode({ inquiryId: "missing", projectFound: false, hasRequestData: false })).toBe("not-found");
  });

  it("routes legacy inquiries to the keyword estimate tool", () => {
    expect(resolveEstimateWorkspaceMode({ inquiryId: "legacy", projectFound: true, hasRequestData: false })).toBe("legacy");
  });

  it("routes request_data inquiries to the stable-ID workspace", () => {
    expect(resolveEstimateWorkspaceMode({ inquiryId: "structured", projectFound: true, hasRequestData: true })).toBe("structured");
  });
});
