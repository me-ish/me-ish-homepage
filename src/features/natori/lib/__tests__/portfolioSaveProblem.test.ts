import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { preparePortfolioContentForSave } from "../portfolioContent";
import { findPortfolioSaveProblem, PORTFOLIO_SECTION_ID_BY_CONTENT_KEY } from "../portfolioSaveProblem";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const base: PortfolioContent = defaultPortfolioContent;

describe("findPortfolioSaveProblem (Q-12)", () => {
  it("returns null for content that can be saved", () => {
    expect(preparePortfolioContentForSave(base)).not.toBeNull();
    expect(findPortfolioSaveProblem(base)).toBeNull();
  });

  it("finds a too-long single field and its section", () => {
    const content = { ...base, artistName: "あ".repeat(201) };
    expect(preparePortfolioContentForSave(content)).toBeNull();
    expect(findPortfolioSaveProblem(content)).toEqual({
      sectionId: "section-basic",
      itemIndex: null,
      reason: "too-long",
      limit: 200,
      detail: null,
    });
  });

  it("finds which list item has the problem (0-based)", () => {
    const works = base.works.length >= 3 ? base.works : [...base.works, ...base.works, ...base.works];
    const target = 2;
    const content = {
      ...base,
      works: works.map((work, index) => (index === target ? { ...work, title: "題".repeat(201) } : work)),
    };
    const problem = findPortfolioSaveProblem(content);
    expect(problem).toMatchObject({ sectionId: "section-works", itemIndex: target, reason: "too-long", limit: 200 });
  });

  it("points at the gallery intro in the works section", () => {
    const content = { ...base, galleryIntro: "あ".repeat(4001) };
    expect(findPortfolioSaveProblem(content)).toMatchObject({
      sectionId: "section-works",
      reason: "too-long",
      limit: 4000,
    });
  });

  it("points at the process video section, keeping the schema's own Japanese reason", () => {
    const content = { ...base, processVideo: { url: "https://example.com/movie.mp4" } };
    expect(preparePortfolioContentForSave(content)).toBeNull();
    expect(findPortfolioSaveProblem(content)).toEqual({
      sectionId: "section-process",
      itemIndex: null,
      reason: "format",
      limit: null,
      detail: "YouTubeの動画URL（https://www.youtube.com/watch?v=… や https://youtu.be/…）を指定してください",
    });
    expect(
      findPortfolioSaveProblem({ ...base, processVideo: { url: "https://youtu.be/dQw4w9WgXcQ", caption: "あ".repeat(201) } })
    ).toMatchObject({ sectionId: "section-process", reason: "too-long", limit: 200 });
    // URLが空の動画は保存時に外れるので、問題にしない
    expect(findPortfolioSaveProblem({ ...base, processVideo: { url: "" } })).toBeNull();
  });

  it("reports an over-long list as too many items, without an item index", () => {
    const content = { ...base, services: Array.from({ length: 31 }, (_, index) => `バッジ${index}`) };
    expect(findPortfolioSaveProblem(content)).toEqual({
      sectionId: "section-services",
      itemIndex: null,
      reason: "too-many",
      limit: 30,
      detail: null,
    });
  });

  it("keeps the schema's own Japanese reason (related links need a work image)", () => {
    const first = base.works[0];
    const content = {
      ...base,
      works: [
        { ...first, image: null, relatedLinks: [{ id: "l1", kind: "client" as const, label: "依頼者", href: "https://example.com/x" }] },
        ...base.works.slice(1),
      ],
    };
    expect(findPortfolioSaveProblem(content)).toEqual({
      sectionId: "section-works",
      itemIndex: 0,
      reason: "format",
      limit: null,
      detail: "関連リンクを保存するには作品画像が必要です",
    });
  });

  it("names the plans and faqs sections", () => {
    const plan = base.plans[0];
    expect(findPortfolioSaveProblem({ ...base, plans: [{ ...plan, price: "円".repeat(201) }, ...base.plans.slice(1)] }))
      .toMatchObject({ sectionId: "section-plans", itemIndex: 0 });
    expect(findPortfolioSaveProblem({ ...base, faqs: [{ question: "Q", answer: "答".repeat(4001) }] }))
      .toMatchObject({ sectionId: "section-faqs", itemIndex: 0, reason: "too-long", limit: 4000 });
  });

  it("maps every editable content field to a section, so new fields are not forgotten", () => {
    const sectionIds = new Set(Object.values(PORTFOLIO_SECTION_ID_BY_CONTENT_KEY));
    const unmapped = Object.keys(base).filter((key) => !(key in PORTFOLIO_SECTION_ID_BY_CONTENT_KEY));
    // 編集画面に欄がなく、保存時にそのまま持ち回るだけの項目
    expect(unmapped.sort()).toEqual(["workflowCompatibilityProjection"].filter((key) => key in base).sort());
    expect(sectionIds.size).toBe(15);
  });
});
