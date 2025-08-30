import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminAnnouncementsClient from './AdminAnnouncementsClient';

export const dynamic = 'force-dynamic';

export default async function AdminAnnouncementsPage() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;

  if (!email || !isAdminEmail(email)) {
    redirect('/admin-login?err=unauthorized');
  }

  return <AdminAnnouncementsClient />;
}
