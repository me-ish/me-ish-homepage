import { describe, expect, it } from "vitest";
import { isAnalyticsExcludedPath } from "@/lib/analyticsPrivacy";

describe("isAnalyticsExcludedPath", () => {
  it.each([
    "/natori/consult/abc123",
    "/ja/natori/quote/abc123",
    "/en/natori/delivery/abc123?x=1",
    "https://www.me-ish.art/natori/consult/abc123",
    "/natori/quote",
  ])("excludes %s", (path) => {
    expect(isAnalyticsExcludedPath(path)).toBe(true);
  });

  it.each([
    "/natori/portfolio",
    "/natori/portfolio/contact",
    "/natori/dashboard",
    "/natori/consultation-guide",
    "https://www.me-ish.art/natori/works/sample",
    "",
    null,
  ])("keeps %s", (path) => {
    expect(isAnalyticsExcludedPath(path)).toBe(false);
  });
});
