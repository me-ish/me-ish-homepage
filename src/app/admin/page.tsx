import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';

export default async function AdminPage() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;

  if (!email || !isAdminEmail(email)) {
    redirect('/admin-login?err=unauthorized');
  }

  // …ここから管理画面の中身…
  return <div className="p-6">管理ダッシュボード</div>;
}
