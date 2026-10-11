import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CertAdminError, requireCertAdmin } from '@/lib/coa/reissueAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    requireCertAdmin(request);
    const { data, error } = await supabaseAdmin().from('cert_links').select('id, entry_id').limit(1);
    if (error) throw new Error('Certificate diagnostics unavailable');
    return NextResponse.json({ ok: true, hasRow: !!data?.length }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: unknown) {
    if (error instanceof CertAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error('[CoA] certificate diagnostics unavailable');
    return NextResponse.json({ ok: false, error: 'certificate diagnostics unavailable' }, { status: 500 });
  }
}
