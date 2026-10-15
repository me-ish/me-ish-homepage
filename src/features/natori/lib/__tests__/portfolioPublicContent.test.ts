import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "../../constants/portfolioContent";
import {
  preparePortfolioContentForSave,
  parsePortfolioContent,
} from "../portfolioContent";
import { parsePortfolioDisplayContent } from "../portfolioDisplay";
import {
  parsePortfolioAssetUrl,
  parsePortfolioAssetFileName,
} from "../portfolioAssetUrl";
import { projectPortfolioPublicContent } from "../portfolioPublicContent";

describe("public portfolio boundary", () => {
  it("removes hidden work, links and dependent artwork without changing the saved content", () => {
    const hidden = {
      ...defaultPortfolioContent.works[0],
      id: "private-work",
      published: false,
      title: "PRIVATE_TITLE_CANARY",
      image: "https://assets.invalid/PRIVATE_IMAGE_CANARY.webp",
      relatedLinks: [
        {
          id: "private-link",
          kind: "usage" as const,
          label: "PRIVATE_LINK_CANARY",
          href: "https://private.invalid/PRIVATE_LINK_CANARY",
        },
      ],
    };
    const shown = {
      ...defaultPortfolioContent.works[0],
      id: "public-work",
      published: true,
      image: "https://assets.invalid/public.webp",
    };
    const stored = {
      ...defaultPortfolioContent,
      works: [hidden, shown],
      heroImage: hidden.image,
      heroImages: [hidden.image, shown.image],
      aboutImage: hidden.image,
      plans: [{ ...defaultPortfolioContent.plans[0], sampleWorkId: hidden.id }],
      massProductionSamples: [
        {
          id: "private-sample",
          name: "PRIVATE_SAMPLE_CANARY",
          image: hidden.image,
        },
      ],
      processVideo: {
        url: "https://youtu.be/abcdefghijk",
        posterWorkId: hidden.id,
      },
    };
    const before = JSON.stringify(stored),
      result = projectPortfolioPublicContent(stored);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(result.works.map((work) => work.id)).toEqual([shown.id]);
    expect(result.heroImages).toEqual([shown.image]);
    expect(result.plans[0].sampleWorkId).toBeNull();
    expect(result.processVideo?.posterWorkId).toBeNull();
    expect(JSON.stringify(stored)).toBe(before);
  });
  it("keeps a hero poster only while it is still a visible hero image", () => {
    const hero = "https://assets.invalid/hero.webp";
    const stored = {
      ...defaultPortfolioContent,
      heroImage: hero,
      heroImages: [hero],
      processVideo: { url: "https://youtu.be/abcdefghijk", posterHeroImage: hero },
    };
    expect(projectPortfolioPublicContent(stored).processVideo?.posterHeroImage).toBe(hero);
    const removed = { ...stored, heroImage: null, heroImages: [] };
    expect(projectPortfolioPublicContent(removed).processVideo?.posterHeroImage).toBeNull();
  });
  it("excludes disabled video URL and caption while keeping legacy published video", () => {
    const video = {
      url: "https://youtu.be/abcdefghijk",
      caption: "PRIVATE_VIDEO_CANARY",
      published: false,
    };
    expect(
      projectPortfolioPublicContent({
        ...defaultPortfolioContent,
        processVideo: video,
      }).processVideo,
    ).toBeUndefined();
    expect(
      projectPortfolioPublicContent({
        ...defaultPortfolioContent,
        processVideo: { ...video, published: true },
      }).processVideo?.url,
    ).toBe(video.url);
  });
  it("preserves ordinary published gallery artwork and display workflow provenance", () => {
    const result = projectPortfolioPublicContent({
      ...defaultPortfolioContent,
      workflowProjectionAllowed: false,
    });
    expect(result.works.map((work) => work.image)).toEqual(
      defaultPortfolioContent.works.map((work) => work.image),
    );
    expect(result.workflowProjectionAllowed).toBe(false);
    expect(result.workflow).toEqual(defaultPortfolioContent.workflow);
  });
});

it("preserves explicit private video through editor normalization, JSON save/read and public projection", () => {
  const prepared = preparePortfolioContentForSave({
    ...defaultPortfolioContent,
    processVideo: {
      url: "https://youtu.be/abcdefghijk",
      caption: "PRIVATE_VIDEO_CANARY",
      published: false,
    },
  });
  expect(prepared?.processVideo?.published).toBe(false);
  const reloaded = parsePortfolioDisplayContent(
    JSON.parse(JSON.stringify(prepared)),
  );
  expect(projectPortfolioPublicContent(reloaded!).processVideo).toBeUndefined();
});
it("preserves private legacy work without collections before and after normalization", () => {
  const { collections: omitted, ...legacy } = defaultPortfolioContent;
  void omitted;
  const input = {
    ...legacy,
    works: [
      { ...legacy.works[0], published: false, title: "PRIVATE_TITLE_CANARY" },
    ],
  };
  expect(parsePortfolioContent(input)?.works[0].published).toBe(false);
  expect(
    projectPortfolioPublicContent(parsePortfolioDisplayContent(input)!).works,
  ).toEqual([]);
});
it("recognizes hidden query, encoded and Storage render aliases while retaining other gallery images", () => {
  const hidden =
    "https://assets.invalid/storage/v1/object/public/natori-portfolio/hidden.webp";
  const alias =
    "https://assets.invalid/storage/v1/render/image/public/natori-portfolio/%68idden.webp?width=600";
  const result = projectPortfolioPublicContent({
    ...defaultPortfolioContent,
    works: [
      { ...defaultPortfolioContent.works[0], published: false, image: hidden },
    ],
    heroImages: [alias, hidden + "?download=1", "/ordinary.webp"],
    aboutImage: alias,
  });
  expect(result.heroImages).toEqual(["/ordinary.webp"]);
  expect(result.aboutImage).toBeNull();
});
it("does not turn another origin or protocol-relative pathname into a managed asset", () => {
  const path =
    "/api/natori/admin/portfolio-assets/00000000-0000-4000-8000-000000000011.webp";
  expect(parsePortfolioAssetUrl(path)?.management).toBe(true);
  expect(parsePortfolioAssetUrl("https://other.invalid" + path)).toBeNull();
  expect(parsePortfolioAssetUrl("//other.invalid" + path)).toBeNull();
});

it.each([
  "https://www.me-ish.art",
  "//www.me-ish.art",
  "https://foreign.invalid",
])(
  "suppresses reserved managed path aliases from %s in both directions",
  (origin) => {
    const id = "00000000-0000-4000-8000-000000000011";
    const local = `/api/natori/admin/portfolio-assets/${id}.webp`;
    const absolute = `${origin}/api/natori/portfolio/assets/${id}.webp`;
    for (const [hidden, shown] of [
      [absolute, local],
      [local, absolute],
    ]) {
      const projected = projectPortfolioPublicContent({
        ...defaultPortfolioContent,
        works: [
          {
            ...defaultPortfolioContent.works[0],
            published: false,
            image: hidden,
          },
        ],
        heroImages: [shown],
        aboutImage: shown,
      });
      expect(projected.heroImages).toEqual([]);
      expect(projected.aboutImage).toBeNull();
    }
  },
);

it.each(["/", "repeat"])(
  "suppresses Next canonical managed path aliases (%s) in both directions",
  (suffix) => {
    const canonical =
      "/api/natori/portfolio/assets/00000000-0000-4000-8000-000000000011.webp";
    const alias =
      suffix === "repeat"
        ? canonical.replace("/natori/", "//natori//")
        : canonical + suffix;
    for (const [hidden, shown] of [
      [canonical, alias],
      [alias, canonical],
    ]) {
      const projected = projectPortfolioPublicContent({
        ...defaultPortfolioContent,
        works: [
          {
            ...defaultPortfolioContent.works[0],
            published: false,
            image: hidden,
          },
        ],
        heroImages: [shown],
        aboutImage: shown,
      });
      expect(projected.heroImages).toEqual([]);
      expect(projected.aboutImage).toBeNull();
    }
    expect(parsePortfolioAssetUrl(alias)?.id).toBe(
      parsePortfolioAssetUrl(canonical)?.id,
    );
  },
);

it("does not double-decode the already-decoded HTTP filename", () => {
  const file = "00000000-0000-4000-8000-000000000011.webp";
  expect(parsePortfolioAssetFileName(file)?.kind).toBe("image");
  expect(parsePortfolioAssetFileName("%30" + file.slice(1))).toBeNull();
  expect(parsePortfolioAssetFileName("%2530" + file.slice(1))).toBeNull();
});
