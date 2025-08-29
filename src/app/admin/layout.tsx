// src/app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;

  if (!email || !isAdminEmail(email)) {
    redirect('/admin-login?err=unauthorized');
  }
  return <>{children}</>;
}
