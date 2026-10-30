// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PortfolioLegalNotice from "../PortfolioLegalNotice";

afterEach(cleanup);

describe("PortfolioLegalNotice", () => {
  it("links the terms, privacy policy and commerce notice in a new tab so the form keeps its input", () => {
    render(<PortfolioLegalNotice />);
    for (const [name, href] of [
      ["ご依頼規約", "/natori/legal/terms"],
      ["プライバシーポリシー", "/natori/legal/privacy"],
      ["特定商取引法に基づく表記", "/natori/legal/tokushoho"],
    ]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(href);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});
