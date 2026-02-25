// src/lib/aura/studio/studioTypes.ts

// ── セクション定義 ────────────────────────────────────────
export type SectionId = 'bio' | 'works' | 'services' | 'skills' | 'contact';

export const SECTION_META: Record<SectionId, { label: string; description: string }> = {
  bio:      { label: '自己紹介',   description: 'About・プロフィール文' },
  works:    { label: '作品',       description: '作品・ポートフォリオ画像' },
  services: { label: 'サービス',   description: '提供サービス・料金メニュー' },
  skills:   { label: 'スキル',     description: 'スキル・ツール一覧' },
  contact:  { label: '連絡先',     description: 'SNS・Webサイト' },
};

export const DEFAULT_SECTION_ORDER: SectionId[] = ['bio', 'works', 'services', 'skills', 'contact'];

export const DEFAULT_SECTION_VISIBILITY: Record<SectionId, boolean> = {
  bio: true, works: true, services: true, skills: true, contact: true,
};

export type WorkItem = {
  imageUrl: string;
  storagePath: string;
  title?: string;
  description?: string;
};

export type ServiceItem = {
  name: string;
  description?: string;
  price?: string;
};

export type SocialLinks = {
  twitter?: string;
  instagram?: string;
  website?: string;
  [key: string]: string | undefined;
};

export type StudioFormData = {
  // Step 1: Profile
  name: string;
  displayTitle: string;
  tagline: string;
  bio: string;
  avatarPath: string;
  avatarPreviewUrl: string;

  // Step 2: Works
  works: WorkItem[];

  // Step 3: Extras
  services: ServiceItem[];
  skills: string[];
  social: SocialLinks;

  // Step 4: Layout
  sectionOrder: SectionId[];
  sectionVisibility: Record<SectionId, boolean>;

  // Step 5: Theme
  themeId: 'pure' | 'night' | 'flow';
  accentColor: string;
  fontPreset: string;
};

export const DEFAULT_STUDIO_FORM: StudioFormData = {
  name: '',
  displayTitle: '',
  tagline: '',
  bio: '',
  avatarPath: '',
  avatarPreviewUrl: '',
  works: [],
  services: [],
  skills: [],
  social: {},
  sectionOrder: [...DEFAULT_SECTION_ORDER],
  sectionVisibility: { ...DEFAULT_SECTION_VISIBILITY },
  themeId: 'pure',
  accentColor: '#00a1e9',
  fontPreset: 'cleanJa',
};

/** DB row からフォームデータへの変換 */
export function dbRowToFormData(row: {
  name?: string | null;
  display_title?: string | null;
  tagline?: string | null;
  bio?: string | null;
  avatar_path?: string | null;
  works?: unknown;
  services?: unknown;
  skills?: unknown;
  social?: unknown;
  section_order?: unknown;
  section_visibility?: unknown;
  theme_id?: string | null;
  accent_color?: string | null;
  font_preset?: string | null;
}): Partial<StudioFormData> {
  // section_order: DB値を検証してフォールバック
  const rawOrder = Array.isArray(row.section_order) ? row.section_order as string[] : [];
  const validOrder = rawOrder.filter((id): id is SectionId => id in DEFAULT_SECTION_VISIBILITY);
  // DBにないセクションIDがあれば末尾に追加
  const missingIds = DEFAULT_SECTION_ORDER.filter((id) => !validOrder.includes(id));
  const sectionOrder: SectionId[] = [...validOrder, ...missingIds];

  // section_visibility: DB値にデフォルト値をマージ
  const rawVis = (row.section_visibility && typeof row.section_visibility === 'object' && !Array.isArray(row.section_visibility))
    ? row.section_visibility as Record<string, boolean>
    : {};
  const sectionVisibility: Record<SectionId, boolean> = {
    ...DEFAULT_SECTION_VISIBILITY,
    ...Object.fromEntries(
      Object.entries(rawVis).filter(([k]) => k in DEFAULT_SECTION_VISIBILITY)
    ),
  };

  return {
    name: row.name ?? '',
    displayTitle: row.display_title ?? '',
    tagline: row.tagline ?? '',
    bio: row.bio ?? '',
    avatarPath: row.avatar_path ?? '',
    avatarPreviewUrl: row.avatar_path ? `/api/aura/assets?path=${encodeURIComponent(row.avatar_path)}` : '',
    works: Array.isArray(row.works) ? (row.works as WorkItem[]) : [],
    services: Array.isArray(row.services) ? (row.services as ServiceItem[]) : [],
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    social: (row.social && typeof row.social === 'object' && !Array.isArray(row.social))
      ? (row.social as SocialLinks)
      : {},
    sectionOrder,
    sectionVisibility,
    themeId: (['pure', 'night', 'flow'].includes(row.theme_id ?? '') ? row.theme_id : 'pure') as StudioFormData['themeId'],
    accentColor: row.accent_color ?? '#00a1e9',
    fontPreset: row.font_preset ?? 'cleanJa',
  };
}
