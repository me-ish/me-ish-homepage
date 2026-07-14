// features/natori/lib/portfolioContent.ts
// PortfolioContent の検証・正規化（DB非依存の純関数）。
import { z } from "zod";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const shortText = z.string().max(200);
const longText = z.string().max(4000);
const imageUrl = z.string().max(1000).nullable();

// 旧形式 (tag: string) と新形式 (tags: string[]) の両方を受け付け、tags に正規化する。
// DB に残っている旧データは読み込み時にここで自動移行される。
const workSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: shortText,
    tag: shortText.optional(),
    tags: z.array(shortText).max(10).optional(),
    image: imageUrl,
  })
  .transform(({ id, title, tag, tags, image }) => ({
    id,
    title,
    tags: (tags ?? (tag !== undefined ? [tag] : []))
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
    image,
  }));

const planSchema = z.object({
  name: shortText,
  price: shortText,
  desc: z.string().max(500),
  features: z.array(shortText).max(20),
});

const optionSchema = z.object({
  name: shortText,
  price: shortText,
});

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
export const portfolioContentSchema = z.object({
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
  works: z.array(workSchema).max(60),
  plans: z.array(planSchema).max(12),
  options: z.array(optionSchema).max(30),
  deliveryLead: longText,
  deliveryNotes: z.array(titleBodySchema).max(20),
  workflow: z.array(titleBodySchema).max(20),
  requests: z.array(longText).max(20),
  socialLinks: z.array(socialLinkSchema).max(10),
  copyright: shortText,
});

/** unknown な値（DB由来など）を検証して PortfolioContent に。失敗時は null */
export function parsePortfolioContent(value: unknown): PortfolioContent | null {
  const result = portfolioContentSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * 編集画面 → プレビュー画面へ未保存の内容を受け渡す localStorage キー。
 * （タブをまたぐため sessionStorage ではなく localStorage を使う）
 */
export const PORTFOLIO_PREVIEW_STORAGE_KEY = "natori-portfolio-preview";

/** 作品のタグからギャラリーのフィルタ一覧を作る（先頭は「すべて」） */
export function galleryFiltersFromWorks(works: PortfolioContent["works"]): string[] {
  const tags: string[] = [];
  for (const work of works) {
    for (const raw of work.tags) {
      const tag = raw.trim();
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }
  return ["すべて", ...tags];
}
