// src/app/admin/payouts/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/isAdmin";
import AdminPayoutsClient from "./AdminPayoutsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "振込管理 | me-ish Admin",
  description: "アーティストへの振込管理",
};

export type PendingPayoutRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  pending_count: number;
  pending_amount: number;
  oldest_purchase_at: string | null;
  latest_purchase_at: string | null;
};

export default async function AdminPayoutsPage() {
  // 1) 認証チェック
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const email = user?.email ?? null;

  if (!email || !isAdminEmail(email)) {
    redirect("/admin-login?err=unauthorized");
  }

  // 2) 振込待ち一覧を取得
  // NOTE: v_pending_payouts は migration 後に利用可能。
  // TypeScript 型定義は Supabase CLI で再生成が必要。
  const admin = supabaseAdmin();
  const { data: pendingPayouts, error } = await (admin as any)
    .from("v_pending_payouts")
    .select("*")
    .order("pending_amount", { ascending: false });

  if (error) {
    console.error("[admin/payouts] v_pending_payouts error:", error);
  }

  // 3) 統計情報
  const rows = (pendingPayouts ?? []) as unknown as PendingPayoutRow[];
  const totalPendingAmount = rows.reduce((sum, r) => sum + (r.pending_amount ?? 0), 0);
  const totalPendingCount = rows.reduce((sum, r) => sum + (r.pending_count ?? 0), 0);
  const artistCount = rows.length;

  return (
    <AdminPayoutsClient
      initialData={rows}
      stats={{
        totalPendingAmount,
        totalPendingCount,
        artistCount,
      }}
    />
  );
}
