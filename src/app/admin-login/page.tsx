// src/app/admin-login/page.tsx
import { createClient } from '@/lib/supabase/server';
import AdminLoginClient from './AdminLoginClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email ?? null;

  // Vercelの環境変数 ADMIN_EMAILS にカンマ区切りで設定 (例: "info@me-ish.art,admin@example.com")
  const allowed = (process.env.ADMIN_EMAILS ?? 'info@me-ish.art')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isAdmin = !!email && allowed.includes(email.toLowerCase());

  // ★ 管理者ならサーバーサイドで即リダイレクト
  if (isAdmin) {
    redirect('/admin');
  }

  return <AdminLoginClient email={email} allowed={allowed} isAdmin={isAdmin} />;
}
