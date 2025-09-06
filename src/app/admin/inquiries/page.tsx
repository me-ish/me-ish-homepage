// src/app/admin/inquiries/page.tsx  ← サーバーコンポーネントに変更
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminInquiriesClient from './AdminInquiriesClient';

export default async function InquiriesPage() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect('/admin-login?err=unauthorized');
  return <AdminInquiriesClient adminEmail={user.email!} />;
}
