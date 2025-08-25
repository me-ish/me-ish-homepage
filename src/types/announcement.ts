// src/types/announcement.ts
export type AnnouncementCategory = 'info' | 'update' | 'maintenance';

export type Announcement = {
  id: string;
  title: string;
  body_md: string;
  category: AnnouncementCategory;
  link_url?: string | null;
  pinned: boolean;
  published_at: string; // ISO文字列 (DateにしてもOK)
};
