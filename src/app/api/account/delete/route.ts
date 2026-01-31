// src/app/api/account/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function supabaseWithCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env missing');

  const cookieStore = cookies();
  return createClient(url, anonKey, {
    global: {
      headers: {
        cookie: cookieStore.toString(),
      },
    },
  });
}

/**
 * POST /api/account/delete
 *
 * アカウント削除 API
 * - 認証済みユーザー本人のみ実行可能
 * - プロフィール情報を匿名化（プライバシーポリシー第7条に基づき、アカウント情報は退会後1年間保持）
 * - 取引記録は法令上の保存義務に基づき7年間保持
 * - Supabase Auth からユーザーを削除
 */
export async function POST(_req: NextRequest) {
  try {
    // 1. 認証確認（Cookie-based session）
    const sb = supabaseWithCookies();
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const admin = supabaseAdmin();

    // 2. 未精算の売上がないかチェック
    const { data: pendingSales, error: salesError } = await admin
      .from('sales')
      .select('id')
      .eq('user_id', userId)
      .eq('payout_status', 'pending')
      .limit(1);

    if (salesError) {
      console.error('[account/delete] sales check error:', salesError);
      return NextResponse.json(
        { error: '売上情報の確認中にエラーが発生しました' },
        { status: 500 }
      );
    }

    if (pendingSales && pendingSales.length > 0) {
      return NextResponse.json(
        {
          error:
            '未精算の売上があるため、退会できません。振込完了後に再度お試しください。',
        },
        { status: 400 }
      );
    }

    // 3. プロフィールを匿名化
    const anonymizedName = '退会済みユーザー';
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        display_name: anonymizedName,
        bio: null,
        avatar_url: null,
        banner_url: null,
        sns_links: {},
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[account/delete] profile anonymization error:', profileError);
      // プロフィール更新失敗してもユーザー削除は続行
    }

    // 4. いいねを削除（RLSがあるため直接SQLで実行）
    try {
      await admin.rpc('delete_user_likes', { target_user_id: userId });
    } catch (likesErr) {
      // likesテーブルの削除に失敗しても続行（RPC未定義の場合もある）
      console.warn('[account/delete] likes deletion skipped:', likesErr);
    }

    // 5. Supabase Auth からユーザーを削除
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[account/delete] auth delete error:', deleteError);
      return NextResponse.json(
        { error: 'アカウントの削除に失敗しました。サポートにお問い合わせください。' },
        { status: 500 }
      );
    }

    console.log(`[account/delete] User ${userId} deleted successfully`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '予期しないエラーが発生しました';
    console.error('[account/delete] unexpected error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET は 405
export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  );
}
