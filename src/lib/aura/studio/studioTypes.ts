// src/lib/aura/studio/studioTypes.ts

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

  // Step 4: Theme
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
  theme_id?: string | null;
  accent_color?: string | null;
  font_preset?: string | null;
}): Partial<StudioFormData> {
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
    themeId: (['pure', 'night', 'flow'].includes(row.theme_id ?? '') ? row.theme_id : 'pure') as StudioFormData['themeId'],
    accentColor: row.accent_color ?? '#00a1e9',
    fontPreset: row.font_preset ?? 'cleanJa',
  };
}
