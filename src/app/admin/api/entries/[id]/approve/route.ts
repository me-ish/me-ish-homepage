// app/admin/api/entries/[id]/approve/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';
import { EntryApprove } from '@/lib/schemas/entry';

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // bodyは現在未使用だが将来拡張
  const _ = await req.json().catch(() => ({}));
  const ok = EntryApprove.safeParse(_).success;
  if (!ok) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const id = Number(params.id);
  const admin = supabaseAdmin();

  // 対象エントリ取得
  const { data: entry, error: gErr } = await admin.from('entries').select('*').eq('id', id).single();
  if (gErr || !entry) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const fileName: string = String(entry.file_name ?? '').trim();
  if (!fileName) return NextResponse.json({ error: 'no_file' }, { status: 400 });

  // 1) 画像を加工キューへコピー（重複は許容）
  const copyRes = await admin.storage.from('artworks').copy(fileName, `pending-processing/${fileName}`);
  if (copyRes.error && !copyRes.error.message.includes('already exists')) {
    return NextResponse.json({ error: 'storage_copy_failed' }, { status: 500 });
  }

  // 2) メタJSONを投入
  const meta = JSON.stringify({ artistName: entry.artist_name, filename: fileName });
  const upRes = await admin.storage
    .from('processing-meta')
    .upload(`pending/${id}.json`, new Blob([meta], { type: 'application/json' }), { upsert: true });
  if (upRes.error) return NextResponse.json({ error: 'meta_upload_failed' }, { status: 500 });

  // 3) DB 承認
  const now = new Date().toISOString();
  const { data: updated, error: uErr } = await admin
    .from('entries')
    .update({ confirmed: true, confirmed_at: now, rejected_at: null, reject_reason: null })
    .eq('id', id)
    .select('*')
    .single();
  if (uErr) return NextResponse.json({ error: 'approve_failed' }, { status: 500 });

  // 4) 合格メール（設定があれば送る。失敗は無視して200を返す）
  try {
    // 既存の送信基盤がResendならここで呼ぶ／なければ内部APIでもOK
    // await sendPassMail(entry.email, entry.artist_name, entry.external_user_id);
  } catch { /* noop */ }

  return NextResponse.json(updated);
}
