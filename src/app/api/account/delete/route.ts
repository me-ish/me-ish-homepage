// src/app/api/account/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function supabaseWithCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env missing');

  const cookieStore = await cookies();
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
export async function POST(req: NextRequest) {
  try {
    // 0. CSRF保護: x-requested-with ヘッダー必須
    if (req.headers.get('x-requested-with') !== 'me-ish') {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 403 }
      );
    }

    // 1. 認証確認（Cookie-based session）
    const sb = await supabaseWithCookies();
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

    // 2. 未精算の売上がないかチェック（sales に user_id はないため entries 経由で絞る）
    const { data: userEntries } = await admin
      .from('entries')
      .select('id')
      .eq('user_id', userId);

    const entryIds = (userEntries ?? []).map((e) => e.id);

    const { data: pendingSales, error: salesError } = entryIds.length > 0
      ? await admin
          .from('sales')
          .select('id')
          .in('entry_id', entryIds)
          .eq('payout_status', 'pending')
          .limit(1)
      : { data: [] as { id: string }[], error: null };

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

    // 3. 作品を非表示化
    const { error: entriesError } = await admin
      .from('entries')
      .update({ display_ready: false })
      .eq('user_id', userId);

    if (entriesError) {
      console.error('[account/delete] entries hide error:', entriesError);
    }

    // 4. AURA非公開化
    const userEmail = user.email;
    if (userEmail) {
      const { error: auraError } = await admin
        .from('aura_requests')
        .update({ visibility: 'private' })
        .eq('email', userEmail);

      if (auraError) {
        console.error('[account/delete] aura privacy error:', auraError);
      }
    }

    // 5. プロフィールを匿名化
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
    }

    // 6. Supabase Auth からユーザーを削除
    // likes/commentsなど、auth.users参照の関連行はCASCADEされる。
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[account/delete] auth delete error:', deleteError);
      return NextResponse.json(
        { error: 'アカウントの削除に失敗しました。サポートにお問い合わせください。' },
        { status: 500 }
      );
    }


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
