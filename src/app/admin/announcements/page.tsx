// src/app/admin/announcements/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminAnnouncementsClient from './AdminAnnouncementsClient';

export default async function AdminAnnouncementsPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect('/admin-login?err=unauthorized');
  }
  return <AdminAnnouncementsClient adminEmail={user.email!} />;
}

