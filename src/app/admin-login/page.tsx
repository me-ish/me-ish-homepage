import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminLoginClient from './AdminLoginClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;

  if (email && isAdminEmail(email)) {
    redirect('/admin');
  }

  // ✅ ヘッダーの高さぶん余白を入れる（スマホでも余裕を持たせて 80px）
  return (
    <main className="px-4 pt-[80px] pb-10">
      <AdminLoginClient currentEmail={email} />
    </main>
  );
}
