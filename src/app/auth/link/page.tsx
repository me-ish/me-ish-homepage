import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function LinkExternalPage({
  searchParams,
}: {
  searchParams: { external?: string | string[] };
}) {
  // external を 1 値に正規化
  const raw = searchParams.external;
  const externalId = Array.isArray(raw) ? raw[0] : raw;
  if (!externalId) {
    redirect('/mypage?linked=error');
  }

  const supabase = supabaseServer();

  // RSC では getUser() でOK（Cookieから判定）
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    redirect(`/login?redirect=/auth/link?external=${encodeURIComponent(externalId)}`);
  }

  // まだ user_id が入っていない行だけを、ログイン中ユーザーにひも付け
  const { error } = await supabase
    .from('entries')
    .update({ user_id: user!.id })
    .eq('external_user_id', externalId)
    .is('user_id', null);

  redirect(error ? '/mypage?linked=error' : '/mypage?linked=success');
}

