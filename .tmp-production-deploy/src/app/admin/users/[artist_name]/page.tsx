// src/app/admin/users/[artist_name]/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';
import AdminUserDetailClient from './AdminUserDetailClient';

export default async function AdminUserDetailPage(
  props: {
    params: Promise<{ artist_name: string }>;
  }
) {
  const params = await props.params;
  const artistName = decodeURIComponent(
    Array.isArray(params?.artist_name)
      ? params.artist_name.join('/')
      : params?.artist_name ?? ''
  );

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect('/admin-login?err=unauthorized');
  }

  return <AdminUserDetailClient adminEmail={user.email!} artistName={artistName} />;
}
