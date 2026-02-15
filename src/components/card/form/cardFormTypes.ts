// src/components/card/form/cardFormTypes.ts
import type { CardFormInput, CardSnsLink, CardWorkItem } from "@/lib/card/card.schema";

export const CARD_FORM_STEPS = [
  { id: 1, label: "プロフィール", labelEn: "Profile" },
  { id: 2, label: "作品", labelEn: "Works" },
  { id: 3, label: "デザイン", labelEn: "Design" },
] as const;

export type CardFormStep = (typeof CARD_FORM_STEPS)[number]["id"];

export const CARD_WORLDVIEWS = [
  { id: "minimal", label: "Minimal", emoji: "🤍" },
  { id: "modern", label: "Modern", emoji: "💎" },
  { id: "business", label: "Business", emoji: "💼" },
  { id: "cute", label: "Cute", emoji: "🌸" },
  { id: "pop", label: "Pop", emoji: "🎨" },
  { id: "dark", label: "Dark", emoji: "🌙" },
  { id: "cyber", label: "Cyber", emoji: "⚡" },
  { id: "natural", label: "Natural", emoji: "🌿" },
  { id: "luxury", label: "Luxury", emoji: "✨" },
  { id: "retro", label: "Retro", emoji: "📻" },
] as const;

export const MAX_WORKS_FREE = 6;
export const MAX_WORKS_PREMIUM = 6;

export type CardFormData = {
  // Step 1
  name: string;
  title: string;
  tagline: string;
  email: string;
  avatarUrl: string;
  avatarPath: string;
  sns: CardSnsLink[];

  // Step 2
  works: CardWorkItem[];

  // Step 3
  worldview: string;
  aiStrength: number;
  tier: "free" | "premium";
};

export const INITIAL_CARD_FORM: CardFormData = {
  name: "",
  title: "",
  tagline: "",
  email: "",
  avatarUrl: "",
  avatarPath: "",
  sns: [
    { type: "twitter", url: "" },
    { type: "instagram", url: "" },
    { type: "website", url: "" },
  ],
  works: [],
  worldview: "minimal",
  aiStrength: 50,
  tier: "free",
};

/**
 * Convert CardFormData to CardFormInput for API submission
 */
export function toCardFormInput(data: CardFormData): CardFormInput {
  return {
    name: data.name,
    title: data.title,
    tagline: data.tagline || undefined,
    email: data.email,
    avatarUrl: data.avatarUrl || undefined,
    avatarPath: data.avatarPath || undefined,
    sns: data.sns.filter((s) => s.url),
    works: data.works.filter((w) => w.imageUrl),
    worldview: data.worldview,
    aiStrength: data.aiStrength,
    tier: data.tier,
  };
}
