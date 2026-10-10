import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) redirect('/admin-login?err=unauthorized');

  const admin = supabaseAdmin();
  const [inquiries, payouts] = await Promise.all([
    admin.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false),
    admin.from('sales').select('*', { count: 'exact', head: true }).eq('payout_status', 'pending').not('purchased_at', 'is', null),
  ]);
  const links = [
    { href: '/natori/dashboard', title: 'ナトリの案件管理', description: '現在の依頼・案件・通知を確認' },
    { href: '/admin/inquiries', title: 'お問い合わせ', description: inquiries.error ? '未読件数を取得できませんでした' : `未読 ${inquiries.count ?? 0}件` },
    { href: '/admin/payouts', title: '売上・振込', description: payouts.error ? '振込待ち件数を取得できませんでした' : `振込待ち ${payouts.count ?? 0}件` },
    { href: '/admin/entries', title: '旧ギャラリーの作品記録', description: '過去の購入・作家の確認' },
    { href: '/admin/announcements', title: 'お知らせ', description: '既存のお知らせ・サポート案内の管理' },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-neutral-900">
      <h1 className="text-2xl font-semibold">管理メニュー</h1>
      <p className="mt-2 text-sm text-neutral-600">旧サービスの公開・新規受付は終了しました。問い合わせと既存購入の対応を継続します。</p>
      <p className="mt-2 text-xs text-neutral-500">{user.email}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-xl border border-neutral-200 bg-white p-5 hover:bg-neutral-50">
            <h2 className="font-semibold">{link.title}</h2>
            <p className="mt-1 text-sm text-neutral-600">{link.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
