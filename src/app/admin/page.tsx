// src/app/admin/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/isAdmin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

// DBスキーマ由来の型をそのまま利用（手書き型のズレ防止）
type EntryRow = Database["public"]["Tables"]["entries"]["Row"];
type InquiryRow = Database["public"]["Tables"]["inquiries"]["Row"];
type AnnRow = Database["public"]["Tables"]["announcements"]["Row"];

export default async function AdminPage() {
  // 1) 認証
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const email = user?.email ?? null;

  if (!email || !isAdminEmail(email)) {
    redirect("/admin-login?err=unauthorized");
  }

  // 2) 集計/一覧は service role で
  const admin = supabaseAdmin();

  // 未審査は confirmed IS NULL / 却下は confirmed = FALSE
  const [
    entriesUnreviewedRes,
    entriesRejectedRes,
    inquiriesUnreadRes,
    salesCountRes,
    pendingPayoutsRes,
    processingPendingRes,
    latestEntriesRes,
    latestInquiriesRes,
    annsDraftCountRes,
    latestAnnsRes,
  ] = await Promise.all([
    admin.from("entries").select("*", { count: "exact", head: true }).is("confirmed", null),
    admin.from("entries").select("*", { count: "exact", head: true }).eq("confirmed", false),
    admin.from("inquiries").select("*", { count: "exact", head: true }).eq("is_read", false),
    admin.from("sales").select("*", { count: "exact", head: true }).not("purchased_at", "is", null),
    // 振込待ち件数
    admin.from("sales").select("*", { count: "exact", head: true }).eq("payout_status", "pending").not("purchased_at", "is", null),
    // ✅ 承認済みなのに display_ready=false（Colab処理/反映待ち）
    admin
      .from("entries")
      .select("*", { count: "exact", head: true })
      .eq("confirmed", true)
      .eq("display_ready", false),

    admin
      .from("entries")
      .select("id,title,artist_name,confirmed,display_ready,created_at")
      .order("created_at", { ascending: false })
      .limit(5),

    admin
      .from("inquiries")
      .select("id,name,email,message,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(5),

    // お知らせ
    admin.from("announcements").select("*", { count: "exact", head: true }).is("published_at", null),
    admin
      .from("announcements")
      .select("id,title,category,pinned,published_at,created_at")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const metrics = {
    unreviewedEntries: entriesUnreviewedRes.count ?? 0,
    rejectedEntries: entriesRejectedRes.count ?? 0,
    unreadInquiries: inquiriesUnreadRes.count ?? 0,
    totalSales: salesCountRes.count ?? 0,
    pendingPayouts: pendingPayoutsRes.count ?? 0,
    draftAnns: annsDraftCountRes.count ?? 0,
    processingPending: processingPendingRes.count ?? 0,
  };

  const latestEntries = (latestEntriesRes.data ?? []) as EntryRow[];
  const latestInquiries = (latestInquiriesRes.data ?? []) as InquiryRow[];
  const latestAnns = (latestAnnsRes.data ?? []) as AnnRow[];

  // 要対応の合計
  const actionRequired = metrics.unreviewedEntries + metrics.unreadInquiries + metrics.pendingPayouts;

  return (
    <main className="min-h-screen bg-[#f7fbff] pt-[70px]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* ヘッダ */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-neutral-500 mt-1">{email}</p>
          </div>
          <Link
            href="/"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-700"
          >
            サイトを開く →
          </Link>
        </div>

        {/* 要対応サマリー */}
        {actionRequired > 0 && (
          <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium text-amber-800">
                {actionRequired}件の対応が必要です
              </span>
            </div>
          </div>
        )}

        {/* ナビゲーションカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          <NavCard
            href="/admin/entries"
            title="作品管理"
            description="応募作品の審査・展示管理"
            badge={metrics.unreviewedEntries > 0 ? `${metrics.unreviewedEntries}件 未審査` : undefined}
            badgeType="warning"
          />
          <NavCard
            href="/admin/inquiries"
            title="お問い合わせ"
            description="ユーザーからの問い合わせ対応"
            badge={metrics.unreadInquiries > 0 ? `${metrics.unreadInquiries}件 未読` : undefined}
            badgeType="warning"
          />
          <NavCard
            href="/admin/payouts"
            title="売上・振込"
            description="売上管理と振込処理"
            badge={metrics.pendingPayouts > 0 ? `${metrics.pendingPayouts}件 振込待ち` : undefined}
            badgeType="info"
          />
          <NavCard
            href="/admin/users"
            title="出展者"
            description="出展者の一覧・管理"
          />
          <NavCard
            href="/admin/announcements"
            title="お知らせ"
            description="サイト内お知らせの管理"
            badge={metrics.draftAnns > 0 ? `${metrics.draftAnns}件 下書き` : undefined}
            badgeType="neutral"
          />
          <NavCard
            href="/admin/settings"
            title="設定"
            description="ギャラリー設定"
          />
        </div>

        {/* 最近のアクティビティ */}
        <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 最近の応募 */}
          <ActivityCard title="応募" href="/admin/entries">
            {latestEntries.length === 0 ? (
              <p className="text-neutral-600 text-sm py-4">最近の応募はありません</p>
            ) : (
              <ul className="space-y-1">
                {latestEntries.map((e) => {
                  const status = e.confirmed === true ? "approved" : e.confirmed === false ? "rejected" : "unreviewed";
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-800">
                          {e.title || `Untitled (#${e.id})`}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {e.artist_name || "アーティスト未設定"}
                        </p>
                      </div>
                      <StatusDot status={status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </ActivityCard>

          {/* 最近のお問い合わせ */}
          <ActivityCard title="お問い合わせ" href="/admin/inquiries">
            {latestInquiries.length === 0 ? (
              <p className="text-neutral-600 text-sm py-4">最近のお問い合わせはありません</p>
            ) : (
              <ul className="space-y-1">
                {latestInquiries.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-800">
                        {displaySubject(q.message)}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {q.name || q.email || "匿名"}
                      </p>
                    </div>
                    {!q.is_read && <StatusDot status="unreviewed" />}
                  </li>
                ))}
              </ul>
            )}
          </ActivityCard>

          {/* 最近のお知らせ */}
          <ActivityCard title="お知らせ" href="/admin/announcements">
            {latestAnns.length === 0 ? (
              <p className="text-neutral-600 text-sm py-4">最近のお知らせはありません</p>
            ) : (
              <ul className="space-y-1">
                {latestAnns.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-800">{n.title}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {n.published_at ? toJP(n.published_at as any) : "下書き"}
                      </p>
                    </div>
                    {n.pinned && (
                      <span className="text-[10px] text-rose-400">PIN</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ActivityCard>
        </div>
      </div>
    </main>
  );
}

/* ---------- utils / sub components ---------- */
function toJP(d: string) {
  try {
    return new Date(d).toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const displaySubject = (msg: string | null) => (msg?.split("\n")[0] ?? "").slice(0, 100) || "(件名なし)";

function NavCard({
  href,
  title,
  description,
  badge,
  badgeType = "neutral",
}: {
  href: string;
  title: string;
  description: string;
  badge?: string;
  badgeType?: "warning" | "info" | "neutral";
}) {
  const badgeColors = {
    warning: "border-amber-300 bg-amber-100 text-amber-800",
    info: "border-sky-300 bg-sky-100 text-sky-800",
    neutral: "border-neutral-300 bg-neutral-100 text-neutral-700",
  };

  return (
    <Link
      href={href}
      className="group relative rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-300 hover:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-neutral-900 transition-colors group-hover:text-sky-700">
            {title}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        </div>
        <span className="text-neutral-400 transition-colors group-hover:text-neutral-600">→</span>
      </div>
      {badge && (
        <div className="mt-3">
          <span className={`inline-block text-xs px-2 py-1 rounded border ${badgeColors[badgeType]}`}>
            {badge}
          </span>
        </div>
      )}
    </Link>
  );
}

function ActivityCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-medium text-neutral-700">{title}</h3>
        <Link href={href} className="text-xs text-neutral-500 transition-colors hover:text-neutral-700">
          すべて見る →
        </Link>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function StatusDot({ status }: { status: "approved" | "rejected" | "unreviewed" }) {
  const colors = {
    approved: "bg-emerald-500",
    rejected: "bg-red-500",
    unreviewed: "bg-amber-500",
  };
  const labels = {
    approved: "承認",
    rejected: "却下",
    unreviewed: "未審査",
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      <span className="text-[10px] text-neutral-500">{labels[status]}</span>
    </div>
  );
}
