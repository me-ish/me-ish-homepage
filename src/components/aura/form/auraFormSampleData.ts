// src/components/aura/form/auraFormSampleData.ts
// Sample data for the "fill sample" feature, extracted from AuraFormWizard.

import type { AuraFormData } from "./auraFormTypes";
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";

const preset = getWorldviewPreset("cute");

export const SAMPLE_FORM_DATA: AuraFormData = {
  // Step 1: Profile
  email: "sample.creator@example.com",
  name: "サンプル イラスト",
  title: "イラストレーター / キャラクターデザイナー",
  tagline: "やさしい色づかいで、世界観のあるイラストを制作します",
  tone: "ですます",
  color: "#FB7185",
  avatarUrl: "",
  avatarPreviewUrl: "",

  // Step 2: Design
  worldviewBase: "cute",
  aiSwing: 50,
  patternBase: preset.patternBase,
  surfaceStyle: preset.surfaceStyle,
  showcaseStyle: preset.showcaseStyle,
  layoutPref: preset.layoutPref,
  languageMode: preset.languageMode,
  fontPreset: preset.fontPreset,

  // Step 3: Works
  images: [],

  // Step 4: About
  bio: "フリーランスのイラストレーターとして活動しています。\nSNSアイコン、配信サムネイル、キャラクターデザインなどを中心に制作。\nご依頼の目的や使用シーンを丁寧に伺い、世界観やトーンを揃えたイラストをご提案します。",
  sections: {
    hero: true,
    about: true,
    works: true,
    services: true,
    skills: true,
    contact: true,
  },

  // Step 4 extras
  aboutLayout: "splitTextLeft",

  // Step 5: Services & Skills
  services: [
    { name: "SNSアイコン制作", price: "¥8,000〜", desc: "用途に合わせて構図や表情をご提案します" },
    { name: "キャラクターデザイン", price: "¥15,000〜", desc: "設定に沿ったオリジナルキャラクター制作" },
  ],
  skillPresets: ["イラスト", "キャラクターデザイン", "アイコン制作", "SNSヘッダー"],
  manualSkills: "厚塗り, やさしい色彩, 世界観づくり",

  // Step 6: Contact
  contactEmail: "",
  twitter: "@sample_illust",
  instagram: "sample.illust",
  behance: "",
  website: "https://portfolio.example.com",

  // Avatar customization
  avatarShape: "circle",
  avatarSize: "md",

  // AI field locks
  aiLockedFields: {
    tagline: false,
    bio: false,
  },
};
