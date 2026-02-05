import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';

export const revalidate = 0;

type WorkflowPhase =
  | 'unreviewed'
  | 'approved_queued'
  | 'processing'
  | 'processing_failed'
  | 'ready_to_enable'
  | 'displaying'
  | 'ended'
  | 'rejected';

type WorkflowRow = {
  phase: WorkflowPhase;
  is_stalled: boolean;
  is_ready_candidate: boolean;
};

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) return null;
  return user;
}

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const gallery = url.searchParams.get('gallery');
  const galleryFilter = gallery && gallery !== 'all' ? gallery : null;

  const admin = supabaseAdmin();
  let query = (admin as any)
    .from('v_admin_entry_workflow')
    .select('phase, is_stalled, is_ready_candidate');

  if (galleryFilter) {
    query = query.eq('gallery_type', galleryFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'overview_failed' }, { status: 500 });
  }

  const rows = ((data ?? []) as WorkflowRow[]);

  const phases: Record<WorkflowPhase, number> = {
    unreviewed: 0,
    approved_queued: 0,
    processing: 0,
    processing_failed: 0,
    ready_to_enable: 0,
    displaying: 0,
    ended: 0,
    rejected: 0,
  };

  let stalled = 0;
  let readyToEnable = 0;

  for (const row of rows) {
    phases[row.phase] += 1;
    if (row.is_stalled && row.phase !== 'processing_failed') stalled += 1;
    if (row.is_ready_candidate) readyToEnable += 1;
  }

  const needsReview = phases.unreviewed;
  const processingFailed = phases.processing_failed;
  const actionTotal = needsReview + processingFailed + stalled + readyToEnable;

  return NextResponse.json({
    total: rows.length,
    phases,
    actionRequired: {
      needsReview,
      processingFailed,
      stalled,
      readyToEnable,
      total: actionTotal,
    },
  });
}
