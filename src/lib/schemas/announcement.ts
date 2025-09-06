// src/lib/schemas/announcement.ts
import { z } from 'zod';

export const AnnouncementCategory = z.enum(['info', 'update', 'maintenance']);

export const AnnouncementBase = z.object({
  title: z.string().min(1).max(120),
  body_md: z.string().max(10000).default(''),
  category: AnnouncementCategory.default('info'),
  pinned: z.boolean().default(false),
  link_url: z.string().url().nullish(),
  // ISO文字列 or null。Zodのstrictなdatetime()は外して互換性優先
  published_at: z.string().nullish(),
});

export const AnnouncementInsert = AnnouncementBase;
export const AnnouncementUpdate = AnnouncementBase.partial();

export type Announcement = {
  id: string;
  title: string;
  body_md: string;
  category: z.infer<typeof AnnouncementCategory>;
  pinned: boolean;
  link_url: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};
