// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import type { PortfolioWork } from "@/features/natori/types/portfolio";
import PortfolioPlanSampleField from "./PortfolioPlanSampleField";

afterEach(cleanup);

const base = defaultPortfolioContent.works[0];
const collections = [{ id: "icon", name: "アイコン", description: "", color: "#D9F3EE" }];
const works: PortfolioWork[] = [
  { ...base, id: "w1", title: "作品1", image: "https://example.com/w1.webp", collectionId: "icon", published: true },
  { ...base, id: "w2", title: "非公開の作品", image: "https://example.com/w2.webp", collectionId: null, published: false },
  { ...base, id: "w3", title: "画像なし", image: null, collectionId: "icon", published: true },
];

function renderField(value: string | null, onChange = vi.fn()) {
  render(<PortfolioPlanSampleField works={works} collections={collections} value={value} onChange={onChange} />);
  return { onChange, select: screen.getByLabelText("作例（ご依頼実績から1枚）") as HTMLSelectElement };
}

describe("PortfolioPlanSampleField", () => {
  it("lists only works that have an image, with their collection and publish state", () => {
    const { select } = renderField(null);
    expect(Array.from(select.options, (option) => option.textContent)).toEqual([
      "なし",
      "作品1（アイコン）",
      "非公開の作品（未分類・非公開）",
    ]);
    expect(screen.getByText("選ぶと、料金表のこのプランに作品の画像が出ます。")).toBeTruthy();
  });

  it("reports the chosen work id, and null when cleared", () => {
    const { select, onChange } = renderField("w1");
    expect(select.value).toBe("w1");
    expect(screen.getByText("料金表のこのプランに表示されます。")).toBeTruthy();
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(select, { target: { value: "w2" } });
    expect(onChange).toHaveBeenLastCalledWith("w2");
  });

  it("warns when the chosen work is unpublished or no longer usable", () => {
    renderField("w2");
    expect(screen.getByText("この作品は非公開のため、料金表には出ません。")).toBeTruthy();
    cleanup();

    const { select } = renderField("deleted");
    expect(screen.getByText("選んでいた作品が見つからないか、画像がありません。料金表には出ません。")).toBeTruthy();
    expect(Array.from(select.options, (option) => option.textContent)).toContain("（見つからない作品）");
    expect(select.value).toBe("deleted");
  });
});
