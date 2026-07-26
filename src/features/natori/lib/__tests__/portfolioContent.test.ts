import { describe, expect, it } from "vitest";
import {
  galleryFiltersFromWorks,
  parsePortfolioContent,
  preparePortfolioContentForSave,
  withPortfolioEditorStableIds,
} from "../portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const validContent: PortfolioContent = {
  commissionOpen: true,
  artistName: "Natori* illust",
  roleEn: "Cute Anime Illustrator",
  profileName: "ナトリ",
  profileRole: "Illustrator",
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
  plans: [
    {
      id: "bust_up",
      name: "胸上",
      price: "4,000円",
      desc: "説明",
      features: ["リテイク2回まで無料"],
    },
  ],
  options: [{ id: "expression_variation", name: "表情差分", price: "+500円" }],
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

  it("profileName / profileRole が無い旧データは空文字で補完される", () => {
    const { profileName: _n, profileRole: _r, ...legacy } = validContent;
    const parsed = parsePortfolioContent(legacy);
    expect(parsed?.profileName).toBe("");
    expect(parsed?.profileRole).toBe("");
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

  it("IDの無い既知legacy項目は完全一致labelだけでstable IDへ補完する", () => {
    const parsed = parsePortfolioContent({
      ...validContent,
      plans: [{ name: "胸上", price: "4,000円", desc: "説明", features: [] }],
      options: [{ name: "表情差分", price: "+500円" }],
    });

    expect(parsed?.plans[0]?.id).toBe("bust_up");
    expect(parsed?.options[0]?.id).toBe("expression_variation");
  });

  it("未知legacy項目を既知IDへ推測で割り当てず、内容を保持する", () => {
    const parsed = parsePortfolioContent({
      ...validContent,
      plans: [{ name: "胸あたり", price: "応相談", desc: "独自", features: ["補足"] }],
      options: [{ name: "独自オプション", price: "+700円" }],
    });

    expect(parsed?.plans[0]).toEqual({
      id: null,
      name: "胸あたり",
      price: "応相談",
      desc: "独自",
      features: ["補足"],
    });
    expect(parsed?.options[0]).toEqual({
      id: null,
      name: "独自オプション",
      price: "+700円",
    });
  });
});

describe("portfolio editor stable IDs", () => {
  it("既存IDは編集・並べ替え・保存準備で再生成しない", () => {
    const reordered: PortfolioContent = {
      ...validContent,
      plans: [
        { id: "full_body", name: "全身", price: "10,000円", desc: "", features: [] },
        { ...validContent.plans[0], name: "胸上イラスト（改名後）" },
      ],
      options: [
        { id: "commercial_use", name: "商用利用", price: "+3,000円" },
        { ...validContent.options[0], name: "表情バリエーション（改名後）" },
      ],
    };

    const prepared = preparePortfolioContentForSave(reordered);
    expect(prepared?.plans.map((plan) => plan.id)).toEqual(["full_body", "bust_up"]);
    expect(prepared?.options.map((option) => option.id)).toEqual([
      "commercial_use",
      "expression_variation",
    ]);
  });

  it("未知legacy項目にはeditor読込時に一度だけopaque IDを発行する", () => {
    const legacy: PortfolioContent = {
      ...validContent,
      plans: [{ ...validContent.plans[0], id: null, name: "独自プラン" }],
      options: [{ ...validContent.options[0], id: null, name: "独自オプション" }],
    };
    const ids = ["plan-opaque", "option-opaque"];
    const first = withPortfolioEditorStableIds(legacy, () => ids.shift() ?? "unexpected");
    const second = withPortfolioEditorStableIds(first, () => "must-not-regenerate");
    const prepared = preparePortfolioContentForSave(second);

    expect(first.plans[0]?.id).toBe("custom-plan-plan-opaque");
    expect(first.options[0]?.id).toBe("custom-option-option-opaque");
    expect(second.plans[0]?.id).toBe(first.plans[0]?.id);
    expect(second.options[0]?.id).toBe(first.options[0]?.id);
    expect(prepared?.plans[0]?.id).toBe(first.plans[0]?.id);
    expect(prepared?.options[0]?.id).toBe(first.options[0]?.id);
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
