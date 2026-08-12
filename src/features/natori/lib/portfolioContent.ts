// features/natori/lib/portfolioContent.ts
// PortfolioContent の検証・正規化（DB非依存の純関数）。
import { z } from "zod";
import {
  LEGACY_PORTFOLIO_OPTION_ID_BY_EXACT_NAME,
  LEGACY_PORTFOLIO_PLAN_ID_BY_EXACT_NAME,
} from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const shortText = z.string().max(200);
const longText = z.string().max(4000);
const imageUrl = z.string().max(1000).nullable();
const stableContentId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/u);
const collectionColor = z.string().regex(/^#[0-9A-F]{6}$/iu);

const collectionSchema = z.object({
  id: stableContentId,
  name: shortText,
  description: z.string().max(500),
  color: collectionColor,
});

// 旧形式 (tag: string) と新形式 (tags: string[]) の両方を受け付け、tags に正規化する。
// DB に残っている旧データは読み込み時にここで自動移行される。
const workSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: shortText,
    tag: shortText.optional(),
    tags: z.array(shortText).max(10).optional(),
    image: imageUrl,
    collectionId: stableContentId.nullable().optional(),
    featured: z.boolean().optional(),
    published: z.boolean().optional(),
  })
  .transform(({ id, title, tag, tags, image, collectionId, featured, published }) => ({
    id,
    title,
    tags: (tags ?? (tag !== undefined ? [tag] : []))
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
    image,
    collectionId: collectionId ?? null,
    featured: featured ?? false,
    published: published ?? true,
  }));

const planSchema = z
  .object({
    id: stableContentId.nullable().optional(),
    name: shortText,
    price: shortText,
    desc: z.string().max(500),
    features: z.array(shortText).max(20),
  })
  .transform(({ id, ...plan }) => ({
    id: id ?? LEGACY_PORTFOLIO_PLAN_ID_BY_EXACT_NAME[plan.name] ?? null,
    ...plan,
  }));

const optionSchema = z
  .object({
    id: stableContentId.nullable().optional(),
    name: shortText,
    price: shortText,
  })
  .transform(({ id, ...option }) => ({
    id: id ?? LEGACY_PORTFOLIO_OPTION_ID_BY_EXACT_NAME[option.name] ?? null,
    ...option,
  }));

const titleBodySchema = z.object({
  title: shortText,
  body: longText,
});

const socialLinkSchema = z.object({
  label: shortText,
  href: z.string().max(1000),
});

// works の旧形式→新形式 transform があるため入力型と出力型が異なる。
// 出力が PortfolioContent と一致することは parsePortfolioContent の戻り値型で担保する。
const portfolioContentBaseSchema = z.object({
  commissionOpen: z.boolean(),
  artistName: shortText,
  roleEn: shortText,
  // 後から追加したフィールド。既存のDB行には無いので default で補う
  profileName: shortText.optional().default(""),
  profileRole: shortText.optional().default(""),
  heroTitleAccent: shortText,
  heroTitleTail: shortText,
  heroDescription: longText,
  heroImage: imageUrl,
  aboutImage: imageUrl,
  aboutParagraphs: z.array(longText).max(20),
  services: z.array(shortText).max(30),
  works: z.array(workSchema).max(300),
  collections: z.array(collectionSchema).max(20).optional(),
  plans: z.array(planSchema).max(12),
  options: z.array(optionSchema).max(30),
  deliveryLead: longText,
  deliveryNotes: z.array(titleBodySchema).max(20),
  workflow: z.array(titleBodySchema).max(20),
  requests: z.array(longText).max(20),
  socialLinks: z.array(socialLinkSchema).max(10),
  copyright: shortText,
});

const LEGACY_NON_COLLECTION_TAGS = new Set(["つなぐ", "VGen", "外部受注"]);
const LEGACY_COLLECTION_COLORS = ["#FFD6E5", "#D9F3EE", "#E8DDF7", "#DCEBFA", "#FBE2D5"];

function legacyCollectionColor(name: string, index: number): string {
  if (/SD|アイコン/i.test(name)) return "#D9F3EE";
  if (name.includes("一枚絵")) return "#FFD6E5";
  if (name.includes("立ち絵")) return "#E8DDF7";
  if (name.includes("卵")) return "#FFF0C9";
  if (name.includes("グッズ")) return "#FBE2D5";
  return LEGACY_COLLECTION_COLORS[index % LEGACY_COLLECTION_COLORS.length];
}

/** collections導入前のタグ式ギャラリーを、読み込み時だけコレクションへ正規化する。 */
function withLegacyCollections(
  content: z.output<typeof portfolioContentBaseSchema>
): PortfolioContent {
  if (content.collections) {
    const collectionIds = new Set(content.collections.map((collection) => collection.id));
    return {
      ...content,
      collections: content.collections,
      works: content.works.map((work) => ({
        ...work,
        collectionId:
          work.collectionId !== null && collectionIds.has(work.collectionId)
            ? work.collectionId
            : null,
      })),
    };
  }

  const collections: PortfolioContent["collections"] = [];
  const collectionIdByName = new Map<string, string>();
  const featuredCountByCollection = new Map<string, number>();
  const works = content.works.map((work) => {
    const collectionName =
      work.tags.find((tag) => !LEGACY_NON_COLLECTION_TAGS.has(tag)) ?? "その他";
    let collectionId = collectionIdByName.get(collectionName);
    if (!collectionId) {
      collectionId = `legacy_collection_${collections.length + 1}`;
      collectionIdByName.set(collectionName, collectionId);
      collections.push({
        id: collectionId,
        name: collectionName,
        description: "",
        color: legacyCollectionColor(collectionName, collections.length),
      });
    }
    const featuredCount = featuredCountByCollection.get(collectionId) ?? 0;
    featuredCountByCollection.set(collectionId, featuredCount + 1);
    return {
      ...work,
      tags: work.tags.filter((tag) => tag !== collectionName),
      collectionId,
      featured: featuredCount < 3,
      published: true,
    };
  });

  return { ...content, collections, works };
}

// collectionsは後から追加されたため、旧JSONを読み込み時に自動移行する。
export const portfolioContentSchema = portfolioContentBaseSchema.transform(withLegacyCollections);

/** unknown な値（DB由来など）を検証して PortfolioContent に。失敗時は null */
export function parsePortfolioContent(value: unknown): PortfolioContent | null {
  const result = portfolioContentSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * 編集画面へ渡す時だけ、ID導入前の未知項目へopaque IDを一度発行する。
 * 既存IDは保持し、DBへの書き込みは明示的な保存操作まで行わない。
 */
export function withPortfolioEditorStableIds(
  content: PortfolioContent,
  createId: () => string = () => crypto.randomUUID()
): PortfolioContent {
  return {
    ...content,
    plans: content.plans.map((plan) =>
      plan.id === null ? { ...plan, id: `custom-plan-${createId()}` } : plan
    ),
    options: content.options.map((option) =>
      option.id === null ? { ...option, id: `custom-option-${createId()}` } : option
    ),
  };
}

/**
 * editorのpreview/save共通入口。軽い正規化後もserverと同じschemaで再検証する。
 * 不正な入力は送信せず null を返す。
 */
export function preparePortfolioContentForSave(content: PortfolioContent): PortfolioContent | null {
  const cleanList = (items: string[]) =>
    items.map((item) => item.trim()).filter((item) => item.length > 0);
  return parsePortfolioContent({
    ...content,
    aboutParagraphs: cleanList(content.aboutParagraphs),
    services: cleanList(content.services),
    requests: cleanList(content.requests),
    works: content.works.map((work) => ({
      ...work,
      title: work.title.trim(),
      tags: cleanList(work.tags),
    })),
    collections: content.collections.map((collection) => ({
      ...collection,
      name: collection.name.trim(),
      description: collection.description.trim(),
    })),
    plans: content.plans.map((plan) => ({
      ...plan,
      features: cleanList(plan.features),
    })),
    socialLinks: content.socialLinks.filter(
      (link) => link.label.trim().length > 0 && link.href.trim().length > 0
    ),
  });
}

/**
 * 編集画面 → プレビュー画面へ未保存の内容を受け渡す localStorage キー。
 * （タブをまたぐため sessionStorage ではなく localStorage を使う）
 */
export const PORTFOLIO_PREVIEW_STORAGE_KEY = "natori-portfolio-preview";

/** 受注経路など、公開カードでは見せない管理用タグを除く。 */
export function publicPortfolioWorkTags(tags: string[]): string[] {
  return tags.filter((tag) => !LEGACY_NON_COLLECTION_TAGS.has(tag));
}
