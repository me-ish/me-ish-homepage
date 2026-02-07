// src/app/api/cron/exhibit-delete/route.ts
// 展示終了から一定期間経過した作品を削除するCron API

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'artworks';
const RETENTION_DAYS = 30;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const token = req.headers.get('x-meish-admin-token');
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (adminToken && token === adminToken) return true;

  return false;
}

function cutoffIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function finalPathFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(?:jpe?g|png|webp|gif|avif|tiff)$/i, '');
  return `final/${base}.png`;
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const cutoff = cutoffIso(RETENTION_DAYS);

  const { data: entries, error: fetchError } = await admin
    .from('entries')
    .select('id, file_name, display_end_at, agree_storage')
    .lt('display_end_at', cutoff)
    .or('agree_storage.is.false,agree_storage.is.null')
    .limit(200);

  if (fetchError) {
    console.error('[exhibit-delete] fetch error:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: 'No entries to delete' });
  }

  const results: { entryId: number; success: boolean; error?: string }[] = [];

  for (const e of entries) {
    const entryId = e.id as number;
    const fileName = e.file_name as string | null;

    try {
      const paths: string[] = [];
      if (fileName) {
        paths.push(fileName);
        paths.push(finalPathFromFileName(fileName));
      }

      if (paths.length > 0) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
        if (rmErr) {
          console.error('[exhibit-delete] storage remove failed:', entryId, rmErr.message);
        }
      }

      const { error: delErr } = await admin
        .from('entries')
        .delete()
        .eq('id', entryId);

      if (delErr) {
        results.push({ entryId, success: false, error: delErr.message });
        continue;
      }

      results.push({ entryId, success: true });
    } catch (err: any) {
      console.error('[exhibit-delete] error for entry:', entryId, err);
      results.push({ entryId, success: false, error: err?.message || String(err) });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    ok: true,
    retentionDays: RETENTION_DAYS,
    cutoff,
    total: entries.length,
    deleted: successCount,
    results,
  });
}
