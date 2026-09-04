// ============================================
// aura.schema.ts（最終統合版＋STEP3 sections対応＋layoutType追加）
// - 既存機能はすべて維持
// - FormInput → Design → Content の互換性確保
// - ThemeSchema に bgGradient / patternLayers / textureLayers / bgStyle を追加
// - works / cta セクションも正式に型として許可
// - FontPreset を auraFonts.ts と揃えて enum 化
// - STEP3 用 sections フラグを FormInputSchema に追加
// - ★ layoutType（L1〜L4）を Design に追加
// ============================================

import { z } from "zod";

/* ---------------------------------------------------------
 * 基本 Enum
 * --------------------------------------------------------- */
export const ToneEnum = z.string();

// 使用しているフォントプリセットをすべて列挙
export const FontPresetSchema = z.enum([
  // 新プリセット
  "cleanJa",
  "modernSans",
  "formalMincho",
  "cuteRound",
  "popBold",
  "techMono",
  "luxurySerif",
  "retroPixel",

  // 互換用（過去データ・旧 preset 名）
  "formalJa",
  "cuteJa",
  "globalBold",
  "serifJa",
  "retroPop",
]);
export type FontPreset = z.infer<typeof FontPresetSchema>;

// 言語は現状 ja / en のみ
export const LanguageModeEnum = z.enum(["ja", "en"]);
export type LanguageMode = z.infer<typeof LanguageModeEnum>;

/* ---------------------------------------------------------
 * レイアウトタイプ（L1〜L4）
 * - L1_BASIC_COLUMN
 * - L2_HERO_SPLIT
 * - L3_WORKS_EMPHASIS
 * - L4_EXPERIMENTAL_MASONRY
 * 実装上は短いキーだけを持たせる
 * --------------------------------------------------------- */
export const LayoutTypeEnum = z.enum(["L1", "L2", "L3", "L4"]);
export type LayoutType = z.infer<typeof LayoutTypeEnum>;

/* ---------------------------------------------------------
 * デザイン基礎（フォームでのベース指定）
 * --------------------------------------------------------- */
export const DesignAnswersSchema = z.object({
  worldviewBase: z.string(),
  patternBase: z.string().optional(),
  surfaceStyle: z.string().optional(),
  showcaseStyle: z.string().optional(),
  layoutPref: z.string().optional(),
  languageMode: LanguageModeEnum.optional(),
  fontPreset: FontPresetSchema.optional(),
});

export type DesignAnswers = z.infer<typeof DesignAnswersSchema>;

/* ---------------------------------------------------------
 * AI 強度（旧来の7項目をそのまま保持）
 * --------------------------------------------------------- */
export const AiStrengthSchema = z.object({
  color: z.number().min(0).max(100).default(0),
  pattern: z.number().min(0).max(100).default(0),
  surface: z.number().min(0).max(100).default(0),
  layout: z.number().min(0).max(100).default(0),
  copywriting: z.number().min(0).max(100).default(0),
  structure: z.number().min(0).max(100).default(0),
  overall: z.number().min(0).max(100).default(0),
});

export type AiStrength = z.infer<typeof AiStrengthSchema>;

/* ---------------------------------------------------------
 * 画像入力（url / imageUrl 両対応）
 * --------------------------------------------------------- */

const ImageInputViaUrlSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),

  // ✅ 追加
  year: z.number().int().min(1900).max(2100).optional(),
});

const ImageInputViaImageUrlSchema = z.object({
  imageUrl: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),

  // ✅ 追加
  year: z.number().int().min(1900).max(2100).optional(),
});



const ImageInputSchema = z.union([
  ImageInputViaUrlSchema,
  ImageInputViaImageUrlSchema,
]);

/* ---------------------------------------------------------
 * STEP3 セクションフラグ
 * --------------------------------------------------------- */
const SectionToggleSchema = z.object({
  hero: z.boolean().optional(),
  about: z.boolean().optional(),
  works: z.boolean().optional(),
  services: z.boolean().optional(),
  skills: z.boolean().optional(),
  contact: z.boolean().optional(),
  cta: z.boolean().optional(),
});

/* ---------------------------------------------------------
 * フォーム入力（FormInput）※ avatarUrl 追加済み
 * --------------------------------------------------------- */
export const FormInputSchema = z.object({
  // 基本情報
  name: z.string().min(1, "お名前を入力してください"),

  // 既存フォームは title を使っている想定
  title: z.string().min(1, "肩書きを入力してください"),

  // キャッチコピー（未入力OK）
  tagline: z.string().optional().or(z.literal("")).optional(),

  // 自己紹介（未入力OK）
  bio: z.string().optional().or(z.literal("")).transform((v) => v ?? ""),

  /* ---------------------------------------------------------
   * ★ プロフィール画像（オプション）
   * URL 形式で渡しておく。未設定なら "" or undefined でOK
   * --------------------------------------------------------- */
  avatarUrl: z
    .string()
    .url("画像URLの形式が正しくありません")
    .optional()
    .or(z.literal(""))
    .optional(),

  // 連絡先
  email: z.string().email("メールアドレスの形式が正しくありません"),
  website: z.string().url().optional().or(z.literal("")).optional(),
  sns: z
    .array(
      z.object({
        type: z.string(), // "x" | "instagram" | "pixiv" | ...
        url: z.string(),
      }),
    )
    .optional(),

  // 作品画像（URL 想定）: url / imageUrl どちらでも OK
  images: z.array(ImageInputSchema).max(20).optional(),

  // スキル
  skills: z
    .array(
      z.union([
        z.string(),
        z.object({
          label: z.string(),
          level: z.number().min(1).max(5).optional(),
        }),
      ]),
    )
    .optional(),

  // 実績・プロジェクト
  projects: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        role: z.string().optional(),
        year: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .optional(),

  // 希望する仕事・募集内容（旧フィールド）
  offerings: z
    .array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
        priceHint: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .optional(),

  // 新UI用 Services（ラベル未入力も許容 / 旧フィールドとの互換込み）
  services: z
    .array(
      z
        .object({
          label: z
            .string()
            .optional()
            .or(z.literal(""))
            .optional(),
          name: z
            .string()
            .optional()
            .or(z.literal(""))
            .optional(),

          // 新UI
          description: z.string().optional(),
          priceHint: z.string().optional(),

          // ★ 旧/フロント側フィールドとの互換
          price: z.string().optional(),
          desc: z.string().optional(),
        })
        .passthrough(), // 余計なキーはそのまま通す
    )
    .optional(),

  // 好きな色・雰囲気（将来拡張用）
  favoriteColors: z
    .array(
      z.object({
        hex: z.string(),
        weight: z.number().min(0).max(100).optional(),
      }),
    )
    .max(5)
    .optional(),

  // 単発 color も拾う
  color: z.string().optional(),

  tone: ToneEnum.optional(), // "cute" | "cool" | "dark" | ...

  // 世界観プリセット
  designAnswers: DesignAnswersSchema,

  // AI 強度
  aiStrength: AiStrengthSchema,

  // テキスト量や構成の希望
  bioLength: z.enum(["short", "medium", "long"]).default("medium"),
  sectionCountHint: z.enum(["simple", "standard", "rich"]).default("standard"),

  // 言語
  languageMode: LanguageModeEnum.optional(),

  // 互換用: role（任意）
  role: z.string().optional(),

  /* ---------------------------------------------------------
   * ★ STEP3: 表示セクションフラグ
   * - 未送信（undefined）の場合 → 旧データ扱いで「全部 ON」（generate 側で処理）
   * - 送信されている場合       → true のものだけ ON
   * --------------------------------------------------------- */
  sections: SectionToggleSchema.optional(),
});

export type FormInput = z.infer<typeof FormInputSchema>;

// ThemeSchema の前あたりに追加
const SectionThemeSchema = z.object({
  bgGradient: z.string().optional(),
  patternLayers: z.array(z.string()).optional(),
  textureLayers: z.array(z.string()).optional(),
  bgStyle: z.any().optional(),
});

/* ---------------------------------------------------------
 * Design（AI が構成したデザイン情報）
 * --------------------------------------------------------- */

const ThemeSchema = z.object({
  colorPrimary: z.string(),
  colorAccent: z.string(),
  colorBG: z.string(),
  colorText: z.string(),

  backgroundPattern: z.string().optional().default("none"),
  patternColor: z.string().optional(),

  languageMode: LanguageModeEnum.optional(),
  fontPreset: FontPresetSchema.optional(),

  // リッチ背景プリセット用
  bgGradient: z.string().optional(),
  patternLayers: z.array(z.string()).optional().default([]),
  textureLayers: z.array(z.string()).optional().default([]),

  // CSS 背景パターン（worldviewPreset から注入）
  // CSSProperties をそのまま通したいので any で受ける
  bgStyle: z.any().optional(),
  sectionTheme: z.record(z.string(), SectionThemeSchema).optional(),
});

export const DesignSectionSchema = z.object({
  type: z.string(),
  order: z.number(),
});

export const DesignSchema = z.object({
  theme: ThemeSchema,
  variantId: z.string(),
  sections: z.array(DesignSectionSchema),

  // ★ 追加：レイアウトタイプ（decideLayout で決定）
  // - "L1" | "L2" | "L3" | "L4"
  // - 未設定の旧データも扱えるよう optional
  layoutType: LayoutTypeEnum.optional(),
});

export type Design = z.infer<typeof DesignSchema>;

/* ---------------------------------------------------------
 * Content（実際に表示する文章・構造）
 * --------------------------------------------------------- */

const CTAButtonSchema = z.object({
  label: z.string().optional(),
  href: z.string().optional(),
});

/**
 * 全セクション共通のベース。
 */
const BaseSectionSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  title: z.string().optional(),
  headings: z.array(z.string()).optional(),
  paragraphs: z.array(z.string()).optional(),
  cta: CTAButtonSchema.optional(),
});

/* ---------- Hero ---------- */

// aura.schema.ts の HeroSectionSchema 付近

const HeroSectionSchema = BaseSectionSchema.extend({
  type: z.literal("hero"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),

  // ★追加：プロフィール画像用
  imageUrl: z.string().optional(),
  avatarUrl: z.string().optional(),

  primaryAction: CTAButtonSchema.optional(),
  secondaryAction: CTAButtonSchema.optional(),
  highlights: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

/* ---------- About ---------- */

// ✅ NEW: About のカード（世界観に合わせて generate 側で注入する前提）
const AboutCardSchema = z.object({
  title: z.string(),
  body: z.string(),
  icon: z.string().optional(), // "spark" など。Renderer側で任意対応
  tone: z.enum(["soft", "clean", "bold"]).optional(),
});

const AboutSectionSchema = BaseSectionSchema.extend({
  type: z.literal("about"),

  // ✅ About背景/レイアウト補助（将来拡張用）
  aboutLayout: z.string().optional(),

  // ✅ “スライダー強度によって付くカード群” を許可
  cards: z.array(AboutCardSchema).optional(),

  // ✅ どのパックを選んだか（デバッグ/再現性用）
  cardPackId: z.string().optional(),
});

/* ---------- Gallery / Works ---------- */

const GalleryItemSchema = z.object({
  imageUrl: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),

  // ✅ 追加
  year: z.number().int().min(1900).max(2100).optional(),
});



const GallerySectionSchema = BaseSectionSchema.extend({
  type: z.literal("gallery"),
  layout: z.enum(["grid", "masonry", "carousel"]).optional(),
  items: z.array(GalleryItemSchema).optional(),
});

const WorksSectionSchema = BaseSectionSchema.extend({
  type: z.literal("works"),
  layout: z.enum(["grid", "masonry", "carousel"]).optional(),
  items: z.array(GalleryItemSchema).optional(),
});

/* ---------- Skills ---------- */

const SkillsSectionSchema = BaseSectionSchema.extend({
  type: z.literal("skills"),
  items: z
    .array(
      z.object({
        label: z.string(),
        level: z.number().min(1).max(5).optional(),
        category: z.string().optional(),
      }),
    )
    .optional(),
});

/* ---------- Services ---------- */

const ServicesSectionSchema = BaseSectionSchema.extend({
  type: z.literal("services"),
  items: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        priceHint: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

/* ---------- Contact ---------- */

const ContactSectionSchema = BaseSectionSchema.extend({
  type: z.literal("contact"),
  description: z.string().optional(),
  email: z.string().optional(),
  links: z
    .array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    )
    .optional(),
});

/* ---------- TextRich ---------- */

const TextRichSectionSchema = BaseSectionSchema.extend({
  type: z.literal("textRich"),
});

/* ---------- CTA ---------- */

const CTASectionSchema = BaseSectionSchema.extend({
  type: z.literal("cta"),
});

/* ---------- Union ---------- */

export const ContentSectionSchema = z.union([
  HeroSectionSchema,
  AboutSectionSchema,
  GallerySectionSchema,
  WorksSectionSchema,
  SkillsSectionSchema,
  ServicesSectionSchema,
  ContactSectionSchema,
  TextRichSectionSchema,
  CTASectionSchema,
]);

export type ContentSection = z.infer<typeof ContentSectionSchema>;

export const ContentSchema = z.object({
  sections: z.array(ContentSectionSchema),
});

export type Content = z.infer<typeof ContentSchema>;
