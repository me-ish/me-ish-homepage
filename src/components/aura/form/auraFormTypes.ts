// src/components/aiPortfolio/form/auraFormTypes.ts
import type { WorldviewBase } from "@/lib/aura/aura.worldviewPresets";
import type { AiPortfolioImageItem } from "@/components/aura/AuraImageUploader";

/* =========================================================
 * ステップ定義
 * ========================================================= */
export const STEPS = [
  { id: 1, label: "プロフィール", shortLabel: "基本" },
  { id: 2, label: "世界観", shortLabel: "デザイン" },
  { id: 3, label: "作品", shortLabel: "作品" },
  { id: 4, label: "自己紹介", shortLabel: "About" },
  { id: 5, label: "サービス", shortLabel: "Skills" },
  { id: 6, label: "連絡先", shortLabel: "SNS" },
  { id: 7, label: "確認", shortLabel: "確認" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/* =========================================================
 * フォームデータ型
 * ========================================================= */
export type AuraFormData = {
  // Step 1: Profile
  email: string;
  name: string;
  title: string;
  tagline: string;
  tone: "ですます" | "フレンドリー";
  color: string;
  avatarUrl: string;
  avatarPreviewUrl: string;

  // Step 2: Design
  worldviewBase: WorldviewBase;
  aiSwing: number;
  patternBase: string;
  surfaceStyle: string;
  showcaseStyle: string;
  layoutPref: string;
  languageMode: string;
  fontPreset: string;

  // Step 3: Works
  images: AiPortfolioImageItem[];

  // Step 4: About
  bio: string;
  sections: {
    hero: boolean;
    about: boolean;
    works: boolean;
    services: boolean;
    skills: boolean;
    contact: boolean;
  };

  // Step 5: Services & Skills
  services: { name: string; price?: string; desc?: string }[];
  skillPresets: string[];
  manualSkills: string;

  // Step 6: Contact
  twitter: string;
  instagram: string;
  behance: string;
  website: string;
};

export const defaultFormData: AuraFormData = {
  email: "",
  name: "",
  title: "",
  tagline: "",
  tone: "ですます",
  color: "#111827",
  avatarUrl: "",
  avatarPreviewUrl: "",

  worldviewBase: "minimal",
  aiSwing: 40,
  patternBase: "none",
  surfaceStyle: "card",
  showcaseStyle: "gallery",
  layoutPref: "center",
  languageMode: "ja",
  fontPreset: "cleanJa",

  images: [],

  bio: "",
  sections: {
    hero: true,
    about: true,
    works: true,
    services: true,
    skills: true,
    contact: true,
  },

  services: [],
  skillPresets: [],
  manualSkills: "",

  twitter: "",
  instagram: "",
  behance: "",
  website: "",
};

/* =========================================================
 * バリデーション
 * ========================================================= */
export type ValidationError = {
  field: string;
  message: string;
};

export function validateStep(step: StepId, data: AuraFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (step) {
    case 1:
      if (!data.email.trim()) {
        errors.push({ field: "email", message: "メールアドレスを入力してください" });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push({ field: "email", message: "有効なメールアドレスを入力してください" });
      }
      if (!data.name.trim()) {
        errors.push({ field: "name", message: "名前を入力してください" });
      }
      if (!data.title.trim()) {
        errors.push({ field: "title", message: "肩書きを入力してください" });
      }
      break;

    case 2:
      if (!data.worldviewBase) {
        errors.push({ field: "worldviewBase", message: "世界観を選択してください" });
      }
      break;

    // Step 3-6 は任意項目のみなのでバリデーションなし
    case 3:
    case 4:
    case 5:
    case 6:
      break;

    case 7:
      // 最終確認: Step1-2の必須項目を再チェック
      const step1Errors = validateStep(1, data);
      const step2Errors = validateStep(2, data);
      errors.push(...step1Errors, ...step2Errors);
      break;
  }

  return errors;
}

export function isStepComplete(step: StepId, data: AuraFormData): boolean {
  return validateStep(step, data).length === 0;
}

export function getCompletedSteps(data: AuraFormData): StepId[] {
  return STEPS.map((s) => s.id).filter((id) => isStepComplete(id, data));
}
