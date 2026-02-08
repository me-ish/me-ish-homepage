// src/lib/aura/aura.renderTypes.ts
// Shared types for AURA renderer components

import type { CSSProperties } from "react";

/**
 * Background style — replaces `bgStyle?: any` in section themes.
 */
export type BgStyle = CSSProperties;

/**
 * Section theme override for per-section background customization.
 */
export type SectionThemeOverride = {
  bgGradient?: string;
  patternLayers?: string[];
  textureLayers?: string[];
  bgStyle?: BgStyle;
};

/**
 * A normalized gallery/works item with resolved image URL.
 */
export type NormalizedSectionItem = {
  imageUrl?: string;
  title?: string;
  name?: string;
  description?: string;
  desc?: string;
  year?: string | number;
  medium?: string;
  category?: string;
  url?: string;
  src?: string;
  image?: string;
  thumbnailUrl?: string;
  thumbnail?: string;
  storagePath?: string;
  path?: string;
  [key: string]: unknown;
};

/**
 * Skill item with normalized level.
 */
export type SkillItem = {
  label: string;
  level: number | null;
};

/**
 * Service item for AuraServices.
 */
export type ServiceItem = {
  title?: string;
  name?: string;
  description?: string;
  desc?: string;
  price?: string | number;
  priceRange?: string;
  duration?: string;
  turnaround?: string;
  icon?: string;
  category?: string;
  [key: string]: unknown;
};

/**
 * Gallery item with resolved image source.
 */
export type GalleryItem = NormalizedSectionItem & {
  imageUrl: string;
};
