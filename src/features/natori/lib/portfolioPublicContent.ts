import type { PortfolioDisplayContent } from "../types/portfolioDisplay";
import {
  portfolioImageIdentity,
  publicPortfolioImageUrl,
} from "./portfolioAssetUrl";

/** Apply one publication boundary before any public API, SSR, RSC or OG output. */
export function projectPortfolioPublicContent(
  content: PortfolioDisplayContent,
): PortfolioDisplayContent {
  const hiddenImages = new Set(
    content.works
      .filter((work) => !work.published)
      .flatMap((work) =>
        work.image ? [portfolioImageIdentity(work.image)] : [],
      ),
  );
  const publicImage = (image: string | null): string | null =>
    image && !hiddenImages.has(portfolioImageIdentity(image))
      ? publicPortfolioImageUrl(image)
      : null;
  const works = content.works
    .filter((work) => work.published)
    .map((work) => ({
      id: work.id,
      title: work.title,
      productionMonth: work.productionMonth,
      tags: [...work.tags],
      image: publicImage(work.image),
      collectionId: work.collectionId,
      featured: work.featured,
      published: true,
      relatedLinks: work.relatedLinks?.map((link) => ({
        id: link.id,
        kind: link.kind,
        label: link.label,
        href: link.href,
      })),
    }));
  const visibleIds = new Set(
    works.filter((work) => work.image).map((work) => work.id),
  );
  const heroImages = (
    content.heroImages ?? (content.heroImage ? [content.heroImage] : [])
  ).flatMap((image) => {
    const url = publicImage(image);
    return url ? [url] : [];
  });
  return {
    ...content,
    works,
    heroImages,
    heroImage: heroImages[0] ?? null,
    aboutImage: publicImage(content.aboutImage),
    massProductionSamples: content.massProductionSamples?.flatMap((sample) => {
      const image = publicImage(sample.image);
      return image ? [{ id: sample.id, name: sample.name, image }] : [];
    }),
    plans: content.plans.map((plan) => ({
      ...plan,
      sampleWorkId:
        plan.sampleWorkId && visibleIds.has(plan.sampleWorkId)
          ? plan.sampleWorkId
          : null,
    })),
    processVideo:
      content.processVideo && content.processVideo.published !== false
        ? {
            ...content.processVideo,
            url: publicPortfolioImageUrl(content.processVideo.url) ?? "",
            posterWorkId:
              content.processVideo.posterWorkId &&
              visibleIds.has(content.processVideo.posterWorkId)
                ? content.processVideo.posterWorkId
                : null,
          }
        : undefined,
  };
}
