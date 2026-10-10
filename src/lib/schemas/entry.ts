// src/lib/schemas/entry.ts
import { z } from 'zod';

export const EntryListQuery = z.object({
  gallery: z.string().default('all'),
  status: z.enum(['all', 'unreviewed', 'approved', 'rejected', 'processing']).default('all'),
  sortKey: z.enum(['created_at', 'confirmed_at', 'display_start_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  keyword: z.string().default(''),
});
