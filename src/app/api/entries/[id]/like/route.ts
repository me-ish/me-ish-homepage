// src/app/api/entries/[id]/like/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 現在のいいね数を取得
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const entryId = req.nextUrl.pathname.split('/').slice(-2)[0]; // [id]を取得

  const { data, error } = await supabase
    .from('entries')
    .select('likes')
    .eq('id', entryId)
    .maybeSingle();

  if (error) {
    console.error('❌ Supabase GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    console.warn(`⚠️ 該当するentryが見つかりませんでした: id=${entryId}`);
    return NextResponse.json({ likes: 0 });
  }

  return NextResponse.json({ likes: data.likes ?? 0 });
}

// POST: いいね数を +1
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const entryId = req.nextUrl.pathname.split('/').slice(-2)[0]; // [id]を取得

  const { data: current, error: getError } = await supabase
    .from('entries')
    .select('likes')
    .eq('id', entryId)
    .maybeSingle();

  if (getError) {
    console.error('❌ Supabase GET error during POST:', getError.message);
    return NextResponse.json({ error: getError.message }, { status: 500 });
  }

  if (!current) {
    console.warn(`⚠️ 該当するentryが見つかりません（POST）: id=${entryId}`);
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const currentLikes = current.likes ?? 0;

  const { data, error } = await supabase
    .from('entries')
    .update({ likes: currentLikes + 1 })
    .eq('id', entryId)
    .select('likes');

  if (error) {
    console.error('❌ Supabase UPDATE error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ likes: data?.[0]?.likes ?? 0 });
}
