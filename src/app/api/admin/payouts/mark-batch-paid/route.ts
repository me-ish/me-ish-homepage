// src/app/api/admin/payouts/mark-batch-paid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/isAdmin";
import { safeCompare } from "@/lib/auth/timingSafe";
import { getSiteUrl } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function supabaseWithCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase env missing");

  const cookieStore = cookies();
  return createClient(url, anonKey, {
    global: {
      headers: {
        cookie: cookieStore.toString(),
      },
    },
  });
}

type PendingPayout = {
  user_id: string;
  display_name: string | null;
  pending_count: number;
  pending_amount: number;
};

/**
 * POST /api/admin/payouts/mark-batch-paid
 *
 * 全ての振込待ちを一括で「振込済み」にマーク
 * Body: { userIds?: string[] } - 省略時は全員対象
 */
export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    let isAuthorized = false;

    // 方法1: ADMIN_API_TOKEN ヘッダー
    const token = req.headers.get("x-meish-admin-token");
    if (token && process.env.ADMIN_API_TOKEN && safeCompare(token, process.env.ADMIN_API_TOKEN)) {
      isAuthorized = true;
    }

    // 方法2: Cookie-based session
    if (!isAuthorized) {
      const sb = supabaseWithCookies();
      const {
        data: { user },
      } = await sb.auth.getUser();
      const email = user?.email ?? null;
      if (email && isAdminEmail(email)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const targetUserIds = body.userIds as string[] | undefined;

    // 1. 振込待ち一覧を取得
    const { data: pendingPayouts, error: pendingError } = await (admin as any)
      .from("v_pending_payouts")
      .select("user_id, display_name, pending_count, pending_amount")
      .order("pending_amount", { ascending: false });

    if (pendingError) {
      console.error("[mark-batch-paid] v_pending_payouts error:", pendingError);
      return NextResponse.json(
        { error: "Failed to fetch pending payouts" },
        { status: 500 }
      );
    }

    let payouts = (pendingPayouts ?? []) as PendingPayout[];

    // 対象ユーザーの絞り込み
    if (targetUserIds && targetUserIds.length > 0) {
      const targetSet = new Set(targetUserIds);
      payouts = payouts.filter((p) => targetSet.has(p.user_id));
    }

    if (payouts.length === 0) {
      return NextResponse.json({
        ok: true,
        processedCount: 0,
        totalAmount: 0,
        results: [],
      });
    }

    // 2. 各ユーザーの振込処理を実行
    const results: {
      userId: string;
      displayName: string | null;
      amount: number;
      saleCount: number;
      payoutId: string | null;
      success: boolean;
      error?: string;
    }[] = [];

    const periodYm = new Date().toISOString().slice(0, 7);
    let totalProcessed = 0;
    let totalAmount = 0;

    for (const payout of payouts) {
      try {
        // 2a. 対象ユーザーのentryを取得
        const { data: userEntries, error: entriesError } = await admin
          .from("entries")
          .select("id")
          .eq("user_id", payout.user_id);

        if (entriesError) {
          results.push({
            userId: payout.user_id,
            displayName: payout.display_name,
            amount: payout.pending_amount,
            saleCount: 0,
            payoutId: null,
            success: false,
            error: "Failed to fetch entries",
          });
          continue;
        }

        const entryIds = (userEntries ?? []).map((e: any) => e.id);

        if (entryIds.length === 0) {
          results.push({
            userId: payout.user_id,
            displayName: payout.display_name,
            amount: 0,
            saleCount: 0,
            payoutId: null,
            success: true,
          });
          continue;
        }

        // 2b. 対象のpending salesを取得
        const { data: pendingSales, error: fetchError } = await admin
          .from("sales")
          .select("id, artist_reward_yen")
          .eq("payout_status", "pending")
          .not("purchased_at", "is", null)
          .in("entry_id", entryIds);

        if (fetchError) {
          results.push({
            userId: payout.user_id,
            displayName: payout.display_name,
            amount: 0,
            saleCount: 0,
            payoutId: null,
            success: false,
            error: "Failed to fetch sales",
          });
          continue;
        }

        if (!pendingSales || pendingSales.length === 0) {
          results.push({
            userId: payout.user_id,
            displayName: payout.display_name,
            amount: 0,
            saleCount: 0,
            payoutId: null,
            success: true,
          });
          continue;
        }

        const saleIds = pendingSales.map((s: any) => s.id);
        const userTotalAmount = pendingSales.reduce(
          (sum: number, s: any) => sum + (s.artist_reward_yen ?? 0),
          0
        );

        // 2c. payoutsレコードを作成
        const { data: payoutRecord, error: payoutError } = await admin
          .from("payouts")
          .insert({
            user_id: payout.user_id,
            period_ym: periodYm,
            amount_yen: userTotalAmount,
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (payoutError) {
          results.push({
            userId: payout.user_id,
            displayName: payout.display_name,
            amount: userTotalAmount,
            saleCount: saleIds.length,
            payoutId: null,
            success: false,
            error: "Failed to create payout record",
          });
          continue;
        }

        const payoutId = payoutRecord.id;

        // 2d. payout_itemsを作成
        const payoutItems = saleIds.map((saleId: string) => ({
          payout_id: payoutId,
          sale_id: saleId,
        }));

        const { error: itemsError } = await admin
          .from("payout_items")
          .insert(payoutItems);

        if (itemsError) {
          console.error(`[mark-batch-paid] payout_items error for ${payout.user_id}:`, itemsError);
          // ロールバック: payoutsレコードを削除
          await admin.from("payouts").delete().eq("id", payoutId);
          results.push({
            userId: payout.user_id,
            displayName: payout.display_name,
            amount: userTotalAmount,
            saleCount: saleIds.length,
            payoutId: null,
            success: false,
            error: "Failed to create payout items",
          });
          continue;
        }

        // 2e. salesのpayout_statusを更新
        const { error: updateError } = await admin
          .from("sales")
          .update({
            payout_status: "paid",
            paid_at: new Date().toISOString(),
            payout_batch_id: payoutId,
          })
          .in("id", saleIds);

        if (updateError) {
          // ロールバック: payout_itemsとpayoutsを削除
          await admin.from("payout_items").delete().eq("payout_id", payoutId);
          await admin.from("payouts").delete().eq("id", payoutId);
          results.push({
            userId: payout.user_id,
            displayName: payout.display_name,
            amount: userTotalAmount,
            saleCount: saleIds.length,
            payoutId: null,
            success: false,
            error: "Failed to update sales",
          });
          continue;
        }

        // 2f. 振込完了メールを送信
        try {
          const { data: profile } = await admin
            .from("profiles")
            .select("display_name")
            .eq("id", payout.user_id)
            .single();

          const { data: authData } = await admin.auth.admin.getUserById(payout.user_id);
          const artistEmail = authData?.user?.email;

          // entries経由でexternal_user_idを取得
          const { data: entryForBank } = await admin
            .from("entries")
            .select("external_user_id")
            .eq("user_id", payout.user_id)
            .not("external_user_id", "is", null)
            .limit(1)
            .maybeSingle();

          let bankAccountLast4: string | undefined;
          if (entryForBank?.external_user_id) {
            const { data: bankAccount } = await admin
              .from("artists_bank_accounts")
              .select("account_number")
              .eq("external_user_id", entryForBank.external_user_id)
              .maybeSingle();
            bankAccountLast4 = bankAccount?.account_number
              ? bankAccount.account_number.slice(-4)
              : undefined;
          }

          if (artistEmail) {
            const siteUrl = getSiteUrl();
            const emailPayload = {
              to: artistEmail,
              name: profile?.display_name || "アーティスト",
              amountYen: Math.round(userTotalAmount),
              periodYm,
              itemCount: saleIds.length,
              paidAt: new Date().toISOString(),
              bankAccountLast4,
              manageUrl: `${siteUrl}/mypage`,
            };

            await fetch(`${siteUrl}/api/send-email/payoutComplete`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-meish-admin-token": process.env.ADMIN_API_TOKEN || "",
              },
              body: JSON.stringify(emailPayload),
            });
          }
        } catch (emailErr) {
          console.error(`[mark-batch-paid] email error for ${payout.user_id}:`, emailErr);
        }

        results.push({
          userId: payout.user_id,
          displayName: payout.display_name,
          amount: userTotalAmount,
          saleCount: saleIds.length,
          payoutId,
          success: true,
        });

        totalProcessed++;
        totalAmount += userTotalAmount;
      } catch (e: any) {
        console.error(`[mark-batch-paid] exception for ${payout.user_id}:`, e);
        results.push({
          userId: payout.user_id,
          displayName: payout.display_name,
          amount: payout.pending_amount,
          saleCount: 0,
          payoutId: null,
          success: false,
          error: e.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processedCount: totalProcessed,
      totalAmount,
      failedCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (e: any) {
    console.error("[mark-batch-paid] exception:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET は 405
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    { status: 405 }
  );
}
