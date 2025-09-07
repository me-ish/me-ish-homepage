// src/app/auth/link/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// 外部IDの簡易バリデーション（UUIDでなくてもOK：英数-/ _ かつ 16〜200文字）
function isValidExternalId(s: string) {
  return /^[A-Za-z0-9._\-]{16,200}$/.test(s);
}

export default async function LinkExternalPage({
  searchParams,
}: {
  searchParams: { external?: string | string[] };
}) {
  // external を 1 値に正規化
  const raw = searchParams.external;
  const externalId = Array.isArray(raw) ? raw[0] : raw;

  if (!externalId || !isValidExternalId(externalId)) {
    redirect('/mypage?linked=error');
  }

  const supabase = supabaseServer();

  // RSC では getUser() でOK（Cookieから判定）
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    // ログインしていなければログインへ（復帰先はこのページ）
    redirect(
      `/login?redirect=/auth/link?external=${encodeURIComponent(externalId)}`
    );
  }

  try {
    // まだ user_id が入っていない行だけを、ログイン中ユーザーにひも付け
    // 併せて external_user_id を null にして使い回しを防ぐ（任意だが推奨）
    const { data, error } = await supabase
      .from('entries')
      .update({ user_id: user.id, external_user_id: null })
      .eq('external_user_id', externalId)
      .is('user_id', null)
      .select('id'); // 更新件数の判定に使う

    if (error) {
      console.error('[auth/link] update error:', error.message);
      redirect('/mypage?linked=error');
    }

    // 該当なし（すでに紐付け済み or externalId が無効）
    if (!data || data.length === 0) {
      redirect('/mypage?linked=error');
    }

    redirect('/mypage?linked=success');
  } catch (e) {
    console.error('[auth/link] fatal:', e);
    redirect('/mypage?linked=error');
  }
}
