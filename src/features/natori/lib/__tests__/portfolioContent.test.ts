import { describe, expect, it } from "vitest";
import {
  galleryFiltersFromWorks,
  parsePortfolioContent,
} from "../portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const validContent: PortfolioContent = {
  commissionOpen: true,
  artistName: "Natori* illust",
  roleEn: "Cute Anime Illustrator",
  heroTitleAccent: "ナトリ",
  heroTitleTail: "のポートフォリオへようこそ",
  heroDescription: "紹介文",
  heroImage: null,
  aboutImage: "https://example.com/icon.webp",
  aboutParagraphs: ["段落1", "段落2"],
  services: ["SNSアイコン"],
  works: [
    { id: "w1", title: "作品1", tags: ["アイコン"], image: null },
    { id: "w2", title: "作品2", tags: ["つなぐ", "立ち絵"], image: "https://example.com/a.webp" },
  ],
  plans: [{ name: "胸上", price: "4,000円", desc: "説明", features: ["リテイク2回まで無料"] }],
  options: [{ name: "表情差分", price: "+500円" }],
  deliveryLead: "約1ヶ月前後",
  deliveryNotes: [{ title: "お急ぎ納品", body: "最短7日" }],
  workflow: [{ title: "ご相談", body: "内容確認" }],
  requests: ["自作発言・AI学習は禁止しております"],
  socialLinks: [{ label: "X (Twitter)", href: "https://x.com/natonato_o" }],
  copyright: "© 2026 Natori* illust.",
};

describe("parsePortfolioContent", () => {
  it("正しい形の content はそのまま通る", () => {
    expect(parsePortfolioContent(validContent)).toEqual(validContent);
  });

  it("壊れた値は null を返す（デフォルトへのフォールバック用）", () => {
    expect(parsePortfolioContent(null)).toBeNull();
    expect(parsePortfolioContent({})).toBeNull();
    expect(parsePortfolioContent({ ...validContent, works: "oops" })).toBeNull();
    expect(
      parsePortfolioContent({ ...validContent, commissionOpen: "yes" })
    ).toBeNull();
  });

  it("余計なフィールドは取り除かれる", () => {
    const parsed = parsePortfolioContent({ ...validContent, hacky: "x" });
    expect(parsed).not.toBeNull();
    expect(parsed && "hacky" in parsed).toBe(false);
  });

  it("旧形式の単一 tag は tags に移行される", () => {
    const parsed = parsePortfolioContent({
      ...validContent,
      works: [
        { id: "w1", title: "旧作品", tag: "アイコン", image: null },
        { id: "w2", title: "タグ空", tag: "  ", image: null },
        { id: "w3", title: "タグ無し", image: null },
      ],
    });
    expect(parsed?.works).toEqual([
      { id: "w1", title: "旧作品", tags: ["アイコン"], image: null },
      { id: "w2", title: "タグ空", tags: [], image: null },
      { id: "w3", title: "タグ無し", tags: [], image: null },
    ]);
  });
});

describe("galleryFiltersFromWorks", () => {
  it("先頭に「すべて」、以降は作品タグを重複なし・出現順で返す", () => {
    expect(
      galleryFiltersFromWorks([
        { id: "1", title: "a", tags: ["アイコン"], image: null },
        { id: "2", title: "b", tags: ["つなぐ", "一枚絵"], image: null },
        { id: "3", title: "c", tags: ["アイコン", "つなぐ"], image: null },
        { id: "4", title: "d", tags: ["  "], image: null },
        { id: "5", title: "e", tags: [], image: null },
      ])
    ).toEqual(["すべて", "アイコン", "つなぐ", "一枚絵"]);
  });

  it("作品ゼロなら「すべて」のみ", () => {
    expect(galleryFiltersFromWorks([])).toEqual(["すべて"]);
  });
});
