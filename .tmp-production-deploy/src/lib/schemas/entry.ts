// src/lib/schemas/entry.ts
import { z } from 'zod';

export const EntryListQuery = z.object({
  gallery: z.string().default('all'),
  status: z.enum(['all', 'unreviewed', 'approved', 'rejected', 'processing']).default('all'),
  sortKey: z.enum(['created_at', 'confirmed_at', 'display_start_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  keyword: z.string().default(''),
});

export const EntryPatch = z.object({
  display_plan: z.string().max(120).nullable().optional(),
  display_start_at: z.string().nullable().optional(), // ISO文字列
  display_end_at: z.string().nullable().optional(),
  display_ready: z.boolean().nullable().optional(),
  is_sold: z.boolean().nullable().optional(),
  edition_total: z.number().int().nullable().optional(),
  edition_sold: z.number().int().nullable().optional(),
  meish_fee_yen: z.number().int().nullable().optional(),
  artist_reward_yen: z.number().int().nullable().optional(),
  // 承認・却下は別APIでのみ操作
});

export const EntryApprove = z.object({
  // 将来パラメータが増えた場合に備えてダミー
});
export const EntryReject = z.object({
  reason: z.string().max(1000).nullable().optional(),
});
export const EntryReset = z.object({});
