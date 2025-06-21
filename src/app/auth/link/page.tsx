import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function LinkExternalPage({
  searchParams,
}: {
  searchParams: { external?: string | string[] };
}) {
  const externalId = searchParams.external;

  if (!externalId || Array.isArray(externalId)) {
    return redirect('/mypage?linked=error');
  }

  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) {
    return redirect(`/login?redirect=/auth/link?external=${externalId}`);
  }

  const { error } = await supabase
    .from('entries')
    .update({ user_id: user.id })
    .eq('external_user_id', externalId)
    .is('user_id', null); 

  if (error) {
    console.error('Error updating entries:', error);
    return redirect('/mypage?linked=error');
  }

  return redirect('/mypage?linked=success');
}

