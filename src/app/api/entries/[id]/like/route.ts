// src/app/api/entries/[id]/like/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

/** 同一オリジン簡易チェック（悪用抑止のため任意） */
function assertOrigin(req: NextRequest) {
  if (!SITE_ORIGIN) return; // 未設定ならスキップ
  const origin = (req.headers.get('origin') || '').replace(/\/$/, '');
  if (origin && origin !== SITE_ORIGIN) {
    const err: any = new Error('forbidden');
    err.status = 403;
    throw err;
  }
}

function parseId(params: { id?: string }) {
  const n = Number(params?.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 現在のいいね数を取得 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = parseId(ctx.params);
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('entries')
    .select('likes')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[likes][GET] supabase error:', error.message);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  return NextResponse.json({ likes: data?.likes ?? 0 });
}

/** いいねを +1（原子的に） */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    assertOrigin(req); // 任意（簡易CSRF/埋め込み対策）
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'forbidden' }, { status: e.status ?? 403 });
  }

  const id = parseId(ctx.params);
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

  const supabase = createClient();

  // --- 推奨: DBのRPCで原子的に +1（下のSQLを作成してください）
  const { data: rpc, error: rpcErr } = await supabase.rpc('inc_likes', { p_entry_id: id });

  if (!rpcErr && typeof rpc === 'number') {
    return NextResponse.json({ likes: rpc });
  }

  // --- フォールバック（非原子的：高負荷下でカウント落ちの可能性あり）
  console.warn('[likes][POST] RPC inc_likes not available, falling back. err =', rpcErr?.message);

  const { data: cur, error: getErr } = await supabase
    .from('entries')
    .select('likes')
    .eq('id', id)
    .single();

  if (getErr) {
    console.error('[likes][POST] get error:', getErr.message);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  const nextLikes = (cur?.likes ?? 0) + 1;

  const { data: upd, error: updErr } = await supabase
    .from('entries')
    .update({ likes: nextLikes })
    .eq('id', id)
    .select('likes')
    .single();

  if (updErr) {
    console.error('[likes][POST] update error:', updErr.message);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  return NextResponse.json({ likes: upd?.likes ?? nextLikes });
}
