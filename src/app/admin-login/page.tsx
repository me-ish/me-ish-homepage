import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminLoginClient from './AdminLoginClient';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;

  if (email && isAdminEmail(email)) {
    redirect('/admin'); // 許可済みならすぐ管理画面へ
  }
   return (
    <main className="px-4 pt-[72px]"> {/* ← ヘッダー高さぶんの余白 */}
      <AdminLoginClient currentEmail={email ?? null} />
    </main>
  );
}

