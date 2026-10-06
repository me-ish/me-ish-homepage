import { describe, expect, it } from "vitest";
import type { PortfolioSaveProblem } from "@/features/natori/lib/portfolioSaveProblem";
import { describePortfolioSaveProblem } from "../portfolioSaveProblemMessage";

const base: PortfolioSaveProblem = {
  sectionId: "section-works",
  itemIndex: null,
  reason: "too-long",
  limit: 200,
  detail: null,
};

describe("describePortfolioSaveProblem", () => {
  it("names the section and the item (1-based) for a too-long field", () => {
    expect(describePortfolioSaveProblem({ ...base, itemIndex: 2 }, "作品")).toBe(
      "「作品」の3件目に、文字数が上限（200文字）を超えている欄があります。"
    );
  });

  it("names only the section when the problem is not inside a list item", () => {
    expect(describePortfolioSaveProblem(base, "基本情報")).toBe(
      "「基本情報」に、文字数が上限（200文字）を超えている欄があります。"
    );
  });

  it("describes a list that holds too many items", () => {
    expect(describePortfolioSaveProblem({ ...base, reason: "too-many", limit: 30 }, "対応内容")).toBe(
      "「対応内容」の項目数が上限（30件）を超えています。"
    );
  });

  it("uses the schema's own reason once, without doubling the full stop", () => {
    const problem: PortfolioSaveProblem = {
      ...base,
      itemIndex: 0,
      reason: "format",
      limit: null,
      detail: "関連リンクを保存するには作品画像が必要です",
    };
    expect(describePortfolioSaveProblem(problem, "作品")).toBe("「作品」の1件目：関連リンクを保存するには作品画像が必要です。");
    expect(describePortfolioSaveProblem({ ...problem, detail: "理由です。" }, "作品")).toBe("「作品」の1件目：理由です。");
  });

  it("falls back to a general sentence for a format problem without a reason", () => {
    expect(describePortfolioSaveProblem({ ...base, reason: "format", limit: null }, "料金")).toBe(
      "「料金」に、空欄や形式を確認してほしい欄があります。"
    );
  });

  it("does not claim a place when the section is unknown", () => {
    expect(describePortfolioSaveProblem({ ...base, sectionId: null }, null)).toBe(
      "文字数が上限（200文字）を超えている欄があります。"
    );
    expect(describePortfolioSaveProblem({ ...base, sectionId: null, reason: "format", limit: null }, null)).toBe(
      "空欄や形式を確認してください。"
    );
  });
});
