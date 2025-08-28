// src/app/admin/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import AdminClient from './_components/AdminClient';

const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'info@me-ish.art')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export default async function AdminPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? null;

  if (!email) redirect('/admin-login');           // 未ログインはログインへ
  if (!allowed.includes(email)) redirect('/admin-login?err=unauthorized');

  return <AdminClient adminEmail={email} initialNewEntryCount={0} initialNewInquiryCount={0} />;
}
