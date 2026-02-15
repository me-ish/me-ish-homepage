// src/lib/card/card.schema.ts
// Card service schema definitions (FormInput, Design, Content)

import { z } from "zod";

/* ---------------------------------------------------------
 * Tier
 * --------------------------------------------------------- */
export const CardTierEnum = z.enum(["free", "premium"]);
export type CardTier = z.infer<typeof CardTierEnum>;

/* ---------------------------------------------------------
 * SNS Link
 * --------------------------------------------------------- */
export const CardSnsLinkSchema = z.object({
  type: z.enum(["twitter", "instagram", "website", "other"]),
  url: z.string().url().or(z.literal("")),
});

export type CardSnsLink = z.infer<typeof CardSnsLinkSchema>;

/* ---------------------------------------------------------
 * Work Item (uploaded image + title)
 * --------------------------------------------------------- */
export const CardWorkItemSchema = z.object({
  imageUrl: z.string(),
  path: z.string().optional(),
  title: z.string().optional(),
  focusX: z.number().min(0).max(100).default(50).optional(),
  focusY: z.number().min(0).max(100).default(50).optional(),
});

export type CardWorkItem = z.infer<typeof CardWorkItemSchema>;

/* ---------------------------------------------------------
 * FormInput (3-step form data)
 * --------------------------------------------------------- */
export const CardFormInputSchema = z.object({
  // Step 1: Profile
  name: z.string().min(1, "お名前を入力してください"),
  title: z.string().min(1, "肩書きを入力してください"),
  tagline: z.string().optional().or(z.literal("")),
  email: z.string().email("メールアドレスの形式が正しくありません"),
  avatarUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .optional(),
  avatarPath: z.string().optional(),
  sns: z.array(CardSnsLinkSchema).max(5).optional(),

  // Step 2: Works
  works: z.array(CardWorkItemSchema).max(5).optional(),

  // Step 3: Design
  worldview: z.string().default("minimal"),
  aiStrength: z.number().min(0).max(100).default(50),
  tier: CardTierEnum.default("free"),
});

export type CardFormInput = z.infer<typeof CardFormInputSchema>;

/* ---------------------------------------------------------
 * Design (preset-based, no OpenAI)
 * --------------------------------------------------------- */
export const CardDesignSchema = z.object({
  worldview: z.string(),
  colorPrimary: z.string(),
  colorAccent: z.string(),
  colorBG: z.string(),
  colorText: z.string(),
  bgGradient: z.string().optional(),
  fontPreset: z.string().optional(),
  animation: z.boolean().default(false),
  aiStrengthLevel: z.enum(["low", "mid", "high"]).optional(),
});

export type CardDesign = z.infer<typeof CardDesignSchema>;

/* ---------------------------------------------------------
 * Content (processed sections for rendering)
 * --------------------------------------------------------- */
export const CardContentSchema = z.object({
  profile: z.object({
    name: z.string(),
    title: z.string(),
    tagline: z.string().optional(),
    email: z.string(),
    avatarUrl: z.string().optional(),
    sns: z.array(CardSnsLinkSchema).optional(),
  }),
  works: z
    .array(
      z.object({
        imageUrl: z.string(),
        title: z.string().optional(),
        focusX: z.number().optional(),
        focusY: z.number().optional(),
      }),
    )
    .optional(),
  qrCodeUrl: z.string().optional(),
  branding: z.boolean().default(true), // "made with me-ish" for free tier
});

export type CardContent = z.infer<typeof CardContentSchema>;
