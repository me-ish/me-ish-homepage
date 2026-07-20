// app/admin-login/page.tsx
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';
import { canAccessNatoriManagement } from '@/features/natori/server/requireNatoriAdmin';
import AdminLoginClient from './AdminLoginClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

// サイト内パスのみ許可（外部URLは /admin にフォールバック）
function safePath(p?: string | string[] | null) {
  if (!p) return '/admin';
  const s = Array.isArray(p) ? p[0] : p;
  return s.startsWith('/') ? s : '/admin';
}

export default async function Page(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const email = user?.email ?? null;

  const nextPath = safePath(searchParams?.next);

  const canUseNextPath =
    email &&
    (nextPath.startsWith('/natori/')
      ? await canAccessNatoriManagement(email)
      : isAdminEmail(email));

  // 既に権限があればダッシュボード or 指定先へ
  if (canUseNextPath) {
    redirect(nextPath);
  }

  return (
    <main className="px-4 pt-[72px]"> {/* ヘッダー高さぶんの余白 */}
      <AdminLoginClient currentEmail={email ?? null} />
    </main>
  );
}
