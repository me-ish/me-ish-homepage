import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminLoginClient from './AdminLoginClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;

  // ここでサーバー側で即判定 → 一致なら /admin へ
  if (isAdminEmail(email)) {
    redirect('/admin');
  }

  // そうでなければログインUIを表示（現在ログイン中のメールも渡して表示）
  return <AdminLoginClient currentEmail={email} />;
}
