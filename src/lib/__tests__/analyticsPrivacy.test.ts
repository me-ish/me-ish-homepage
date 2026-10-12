import { describe, expect, it } from "vitest";
import { isAnalyticsExcludedPath } from "@/lib/analyticsPrivacy";

describe("isAnalyticsExcludedPath", () => {
  it.each([
    "/natori/consult/abc123",
    "/ja/natori/quote/abc123",
    "/en/natori/delivery/abc123?x=1",
    "https://www.me-ish.art/natori/consult/abc123",
    "/natori/quote",
    "/cert/12?t=synthetic-token",
    "/ja/cert/12",
    "https://www.me-ish.art/en/cert/12?t=synthetic-token",
    "/ja/%63ert/12?t=synthetic-token",
    "/cert",
    "/ja/%6eatori/%63onsult/synthetic-token",
    "/en/natori%2fdelivery/synthetic-token",
    "/ja/%256eatori/quote/synthetic-token",
    "//www.me-ish.art/en/natori/delivery/synthetic-token",
    "/ja//natori//quote/synthetic-token",
    "https://[invalid",
    "/bad%escape",
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
    undefined,
    "/natori/quotes/example",
    "/certificate-guide",
    "/natori/quote-preview/example",
    "/aura/u/portfolio",
  ])("keeps %s", (path) => {
    expect(isAnalyticsExcludedPath(path)).toBe(false);
  });
});
