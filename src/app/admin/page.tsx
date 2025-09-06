// src/app/admin/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/isAdmin';

export const dynamic = 'force-dynamic';

type EntryRow = {
  id: number;
  title: string | null;
  artist_name: string | null;
  confirmed: boolean | null;      // ← 三値
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

type AnnRow = {
  id: string;
  title: string;
  category: 'info' | 'update' | 'maintenance' | string;
  pinned: boolean | null;
  published_at: string | null;
  created_at: string;
};

export default async function AdminPage() {
  // 1) 認証（ユーザーの特定は server client でOK）
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const email = user?.email ?? null;

  if (!email || !isAdminEmail(email)) {
    redirect('/admin-login?err=unauthorized');
  }

  // 2) 集計/一覧は service role でRLS非依存に
  const admin = supabaseAdmin();

  // 未審査は confirmed IS NULL / 却下は confirmed = FALSE
  const [
    entriesUnreviewedRes,
    entriesRejectedRes,
    inquiriesUnreadRes,
    salesPendingMintRes,
    salesCountRes,
    latestEntriesRes,
    latestInquiriesRes,
    annsDraftCountRes,
    latestAnnsRes,
  ] = await Promise.all([
    admin.from('entries').select('*', { count: 'exact', head: true }).is('confirmed', null),
    admin.from('entries').select('*', { count: 'exact', head: true }).eq('confirmed', false),
    admin.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false),
    admin.from('sales').select('*', { count: 'exact', head: true }).eq('type', 'nft').eq('mint_status', 'pending'),
    admin.from('sales').select('*', { count: 'exact', head: true }).in('status', ['paid', 'settled']),
    admin.from('entries')
      .select('id,title,artist_name,confirmed,created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    admin.from('inquiries')
      .select('id,name,email,subject,is_read,created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    // お知らせ
    admin.from('announcements').select('*', { count: 'exact', head: true }).is('published_at', null),
    admin.from('announcements')
      .select('id,title,category,pinned,published_at,created_at')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const metrics = {
    unreviewedEntries: entriesUnreviewedRes.count ?? 0, // 未審査
    rejectedEntries: entriesRejectedRes.count ?? 0,     // 却下
    unreadInquiries: inquiriesUnreadRes.count ?? 0,
    pendingMints: salesPendingMintRes.count ?? 0,
    totalSales: salesCountRes.count ?? 0,
    draftAnns: annsDraftCountRes.count ?? 0,
  };

  const latestEntries = (latestEntriesRes.data ?? []) as EntryRow[];
  const latestInquiries = (latestInquiriesRes.data ?? []) as InquiryRow[];
  const latestAnns = (latestAnnsRes.data ?? []) as AnnRow[];

  const btnOutlineCls =
    'inline-flex items-center rounded-full border border-[#d9e6f2] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#f7fbff]';

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
            <Link href="/" className={btnOutlineCls}>サイトを開く</Link>
          </div>
        </div>

        {/* メトリクス */}
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="未審査作品" value={metrics.unreviewedEntries} href="/admin/entries" badge={metrics.unreviewedEntries > 0 ? '要対応' : undefined} />
          <MetricCard label="却下作品" value={metrics.rejectedEntries} href="/admin/entries?status=rejected" />
          <MetricCard label="未読お問い合わせ" value={metrics.unreadInquiries} href="/admin/inquiries" />
          <MetricCard label="NFTミント待ち" value={metrics.pendingMints} href="/admin/sales" />
          <MetricCard label="売上件数 (累計)" value={metrics.totalSales} href="/admin/sales" />
          <MetricCard label="未公開お知らせ" value={metrics.draftAnns} href="/admin/announcements" badge={metrics.draftAnns > 0 ? '下書きあり' : undefined} />
        </section>

        {/* クイックアクション */}
        <section className="mt-6">
          <div className="rounded-2xl border bg-white p-4">
            <h2 className="text-sm font-semibold text-[#667] mb-3">クイック操作</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/entries" className={btnOutlineCls}>応募作品の管理</Link>
              <Link href="/admin/inquiries" className={btnOutlineCls}>お問い合わせ一覧</Link>
              <Link href="/admin/users" className={btnOutlineCls}>出展者一覧</Link>
              <Link href="/admin/settings" className={btnOutlineCls}>ギャラリー設定</Link>
              <Link href="/admin/announcements" className={btnOutlineCls}>お知らせ管理</Link>
            </div>
          </div>
        </section>

        {/* 最近のアクティビティ */}
        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* 最近の応募 */}
          <div className="rounded-2xl border bg-white">
            <HeaderWithLink title="最近の応募" href="/admin/entries" />
            <ul className="divide-y">
              {latestEntries.length === 0 ? (
                <EmptyList message="最近の応募はありません。" />
              ) : latestEntries.map((e) => {
                const status = e.confirmed === true ? 'approved' : e.confirmed === false ? 'rejected' : 'unreviewed';
                const cls =
                  status === 'approved'
                    ? 'bg-[#e8fff1] text-[#0d7a3e] border-[#b9f0cf]'
                    : status === 'rejected'
                    ? 'bg-[#ffe9e9] text-[#a11] border-[#ffd0d0]'
                    : 'bg-[#fff8e8] text-[#8a5b00] border-[#ffe2a9]';
                const label = status === 'approved' ? '承認' : status === 'rejected' ? '却下' : '未審査';
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.title || `Untitled (#${e.id})`}</p>
                        <p className="truncate text-xs text-[#667]">
                          {e.artist_name || 'アーティスト未設定'} ・ {toJP(e.created_at)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] border ${cls}`}>{label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 最近のお問い合わせ */}
          <div className="rounded-2xl border bg白">
            <HeaderWithLink title="最近のお問い合わせ" href="/admin/inquiries" />
            <ul className="divide-y">
              {latestInquiries.length === 0 ? (
                <EmptyList message="最近のお問い合わせはありません。" />
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

          {/* 最近のお知らせ */}
          <div className="rounded-2xl border bg-white">
            <HeaderWithLink title="最近のお知らせ" href="/admin/announcements" />
            <ul className="divide-y">
              {latestAnns.length === 0 ? (
                <EmptyList message="最近のお知らせはありません。" />
              ) : latestAnns.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{n.title}</p>
                      <p className="truncate text-xs text-[#667]">
                        {n.published_at ? `公開: ${toJP(n.published_at)}` : `下書き: ${toJP(n.created_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {n.pinned ? (
                        <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 text-[11px]">固定</span>
                      ) : null}
                      <span
                        className={
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] border ' +
                          (n.category === 'maintenance'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : n.category === 'update'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-sky-100 text-sky-800 border-sky-200')
                        }
                      >
                        {n.category}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------- utils / sub components ---------- */
function toJP(d: string) {
  try {
    return new Date(d).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        {badge && (
          <span className="text-[10px] rounded bg-[#fff6d8] text-[#8a5b00] px-2 py-0.5 border border-[#ffe3a6]">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

function HeaderWithLink({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <h3 className="text-sm font-semibold text-[#667]">{title}</h3>
      <Link href={href} className="text-xs text-[#00a1e9] underline underline-offset-4">
        一覧へ
      </Link>
    </div>
  );
}

function EmptyList({ message }: { message: string }) {
  return <li className="px-4 py-6 text-sm text-[#667]">{message}</li>;
}
