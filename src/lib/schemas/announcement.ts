// src/lib/schemas/announcement.ts
import { z } from 'zod';

export const AnnouncementCategory = z.enum(['info', 'update', 'maintenance']);

export const AnnouncementBase = z.object({
  title: z.string().min(1).max(120),
  body_md: z.string().max(10000).default(''),
  category: AnnouncementCategory.default('info'),
  pinned: z.boolean().default(false),

  // http/https の正規化はAPI側で実施。ここは存在チェックだけ
  link_url: z.string().url().nullish(),

  // 公開時刻: 値があるなら文字列、無ければ undefined/null を許可
  // （API側で null の場合は “キー省略” する実装にしている）
  published_at: z.string().nullish(),

  // ★ これが抜けていた：DBに合わせて追加（null/undefined許可）
  expires_at: z.string().nullish(),
});

export const AnnouncementInsert = AnnouncementBase;
export const AnnouncementUpdate = AnnouncementBase.partial();

// ※ドメイン型を手書きするなら DB とズレないように expires_at も入れる
export type Announcement = {
  id: string;
  title: string;
  body_md: string;
  category: z.infer<typeof AnnouncementCategory>;
  pinned: boolean;
  link_url: string | null;
  published_at: string | null;
  expires_at: string | null;      // ★ 追加
  created_at: string | null;
  updated_at: string | null;
};

