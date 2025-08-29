// src/app/admin/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';
import { isAdminEmail } from '@/lib/isAdmin';

export const dynamic = 'force-dynamic';

type EntryRow = {
  id: number;
  title: string | null;
  artist_name: string | null;
  confirmed: boolean | null;
  created_at: string;
};

type InquiryRow = {
  id: number;
  name: string | null;
  email: string | null;
  subject: string | null;
  is_read: boolean | null;
  created_at: string;
};

export default async function AdminPage() {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? null;

  // 管理者チェック（サーバー側のみ）
  if (!email || !isAdminEmail(email)) {
    redirect('/admin-login?err=unauthorized');
  }

  // 集計（未承認作品 / 未読お問い合わせ / NFTミント待ち / 総売上点数）
  const [
    entriesPendingRes,
    inquiriesUnreadRes,
    salesPendingMintRes,
    salesCountRes,
    latestEntriesRes,
    latestInquiriesRes,
  ] = await Promise.all([
    supabase.from('entries').select('*', { count: 'exact', head: true }).eq('confirmed', false),
    supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false),
    // sales: type=nft & mint_status=pending を想定（テーブル名/カラムはご環境に合わせてください）
    supabase.from('sales').select('*', { count: 'exact', head: true }).eq('type', 'nft').eq('mint_status', 'pending'),
    supabase.from('sales').select('*', { count: 'exact', head: true }).in('status', ['paid', 'settled']),
    // 最近のアクティビティ（各5件）
    supabase.from('entries')
      .select('id,title,artist_name,confirmed,created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('inquiries')
      .select('id,name,email,subject,is_read,created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const metrics = {
    pendingEntries: entriesPendingRes.count ?? 0,
    unreadInquiries: inquiriesUnreadRes.count ?? 0,
    pendingMints: salesPendingMintRes.count ?? 0,
    totalSales: salesCountRes.count ?? 0,
  };

  const latestEntries = (latestEntriesRes.data ?? []) as EntryRow[];
  const latestInquiries = (latestInquiriesRes.data ?? []) as InquiryRow[];

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-[#f6fbff] pt-[70px]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* ヘッダ */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#222]">管理ダッシュボード</h1>
            <p className="text-sm text-[#667]">ログイン中: {email}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-[#d9e6f2] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f7fbff]"
            >
              サイトを開く
            </Link>
          </div>
        </div>

        {/* メトリクス */}
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="未承認作品" value={metrics.pendingEntries} href="/admin/entries" badge="要対応" />
          <MetricCard label="未読お問い合わせ" value={metrics.unreadInquiries} href="/admin/inquiries" />
          <MetricCard label="NFTミント待ち" value={metrics.pendingMints} href="/admin/sales" />
          <MetricCard label="売上件数 (累計)" value={metrics.totalSales} href="/admin/sales" />
        </section>

        {/* クイックアクション */}
        <section className="mt-6">
          <div className="rounded-2xl border bg-white p-4">
            <h2 className="text-sm font-semibold text-[#667] mb-3">クイック操作</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/entries" className="btn-outline">応募作品の管理</Link>
              <Link href="/admin/inquiries" className="btn-outline">お問い合わせ一覧</Link>
              <Link href="/admin/users" className="btn-outline">出展者一覧</Link>
              <Link href="/admin/settings" className="btn-outline">ギャラリー設定</Link>
            </div>
          </div>
        </section>

        {/* 最近のアクティビティ */}
        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-[#667]">最近の応募</h3>
              <Link href="/admin/entries" className="text-xs text-[#00a1e9] underline underline-offset-4">
                一覧へ
              </Link>
            </div>
            <ul className="divide-y">
              {latestEntries.length === 0 ? (
                <li className="px-4 py-6 text-sm text-[#667]">最近の応募はありません。</li>
              ) : latestEntries.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.title || `Untitled (#${e.id})`}</p>
                      <p className="truncate text-xs text-[#667]">
                        {e.artist_name || 'アーティスト未設定'} ・ {toJP(e.created_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] border ${e.confirmed ? 'bg-[#e8fff1] text-[#0d7a3e] border-[#b9f0cf]' : 'bg-[#fff8e8] text-[#8a5b00] border-[#ffe2a9]'}`}>
                      {e.confirmed ? '承認済' : '承認待ち'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-[#667]">最近のお問い合わせ</h3>
              <Link href="/admin/inquiries" className="text-xs text-[#00a1e9] underline underline-offset-4">
                一覧へ
              </Link>
            </div>
            <ul className="divide-y">
              {latestInquiries.length === 0 ? (
                <li className="px-4 py-6 text-sm text-[#667]">最近のお問い合わせはありません。</li>
              ) : latestInquiries.map((q) => (
                <li key={q.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{q.subject || '(件名なし)'}</p>
                      <p className="truncate text-xs text-[#667]">
                        {q.name || q.email || '匿名'} ・ {toJP(q.created_at)}
                      </p>
                    </div>
                    {!q.is_read && (
                      <span className="shrink-0 rounded-full bg-[#ffe9e9] text-[#a11] border border-[#ffd0d0] px-2 py-0.5 text-[11px]">
                        未読
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* ちょいユーティリティ（Tailwindのクラス短縮） */}
      <style jsx global>{`
        .btn-outline {
          @apply inline-flex items-center rounded-full border border-[#d9e6f2] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#f7fbff];
        }
      `}</style>
    </main>
  );
}

/* ---------- small utils ---------- */
function toJP(d: string) {
  try {
    return new Date(d).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function MetricCard({
  label,
  value,
  href,
  badge,
}: { label: string; value: number | string; href: string; badge?: string }) {
  return (
    <Link href={href} className="rounded-2xl border bg-white p-4 hover:shadow transition block">
      <div className="text-xs text-[#667]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-xl font-semibold">{value}</div>
        {badge && <span className="text-[10px] rounded bg-[#fff6d8] text-[#8a5b00] px-2 py-0.5 border border-[#ffe3a6]">{badge}</span>}
      </div>
    </Link>
  );
}
