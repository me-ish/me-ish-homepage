// src/app/admin/entries/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminEntriesClient from './AdminEntriesClient';

export default async function AdminEntriesPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect('/admin-login?err=unauthorized');
  return <AdminEntriesClient adminEmail={user.email!} />;
}
