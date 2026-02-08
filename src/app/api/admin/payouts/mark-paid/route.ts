// src/app/api/admin/payouts/mark-paid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/isAdmin";
import { safeCompare } from "@/lib/auth/timingSafe";
import { getSiteUrl } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * POST /api/admin/payouts/mark-paid
 * Body: { userId: string }
 *
 * 認証方法:
 * 1. Cookie-based session (管理者メールチェック)
 * 2. ADMIN_API_TOKEN ヘッダー
 */
export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    let isAuthorized = false;
    let adminEmail = "api-token";

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
        adminEmail = email;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // リクエストボディを解析
    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // UUID形式チェック
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: "Invalid userId format" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // 1. 対象ユーザーのentryを取得
    const { data: userEntries, error: entriesError } = await admin
      .from("entries")
      .select("id")
      .eq("user_id", userId);

    if (entriesError) {
      console.error("[admin/payouts/mark-paid] entries error:", entriesError);
      return NextResponse.json(
        { error: "Failed to fetch user entries" },
        { status: 500 }
      );
    }

    const entryIds = (userEntries ?? []).map((e: any) => e.id);

    if (entryIds.length === 0) {
      return NextResponse.json({
        ok: true,
        updatedCount: 0,
        totalAmount: 0,
        payoutId: null,
      });
    }

    // 2. 対象のpending salesを取得
    const { data: pendingSales, error: fetchError } = await admin
      .from("sales")
      .select("id, artist_reward_yen, entry_id")
      .eq("payout_status", "pending")
      .not("purchased_at", "is", null)
      .in("entry_id", entryIds);

    if (fetchError) {
      console.error("[admin/payouts/mark-paid] fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch pending sales" },
        { status: 500 }
      );
    }

    if (!pendingSales || pendingSales.length === 0) {
      return NextResponse.json({
        ok: true,
        updatedCount: 0,
        totalAmount: 0,
        payoutId: null,
      });
    }

    const saleIds = pendingSales.map((s: any) => s.id);
    const totalAmount = pendingSales.reduce(
      (sum: number, s: any) => sum + (s.artist_reward_yen ?? 0),
      0
    );
    const periodYm = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // 3. payoutsレコードを作成
    const { data: payout, error: payoutError } = await admin
      .from("payouts")
      .insert({
        user_id: userId,
        period_ym: periodYm,
        amount_yen: totalAmount,
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (payoutError) {
      console.error("[admin/payouts/mark-paid] payout insert error:", payoutError);
      return NextResponse.json(
        { error: "Failed to create payout record" },
        { status: 500 }
      );
    }

    const payoutId = payout.id;

    // 4. payout_itemsを作成
    const payoutItems = saleIds.map((saleId: string) => ({
      payout_id: payoutId,
      sale_id: saleId,
    }));

    const { error: itemsError } = await admin
      .from("payout_items")
      .insert(payoutItems);

    if (itemsError) {
      console.error("[admin/payouts/mark-paid] items insert error:", itemsError);
      // ロールバック: payoutsレコードを削除
      await admin.from("payouts").delete().eq("id", payoutId);
      return NextResponse.json(
        { error: "Failed to create payout items" },
        { status: 500 }
      );
    }

    // 5. salesのpayout_statusを更新
    const { error: updateError } = await admin
      .from("sales")
      .update({
        payout_status: "paid",
        paid_at: new Date().toISOString(),
        payout_batch_id: payoutId,
      })
      .in("id", saleIds);

    if (updateError) {
      console.error("[admin/payouts/mark-paid] sales update error:", updateError);
      // ロールバック: payout_itemsとpayoutsを削除
      await admin.from("payout_items").delete().eq("payout_id", payoutId);
      await admin.from("payouts").delete().eq("id", payoutId);
      return NextResponse.json(
        { error: "Failed to update sales status" },
        { status: 500 }
      );
    }


    // 6. 振込完了メールを送信
    try {
      // ユーザー情報を取得
      const { data: profile } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .single();

      // ユーザーのメールアドレスを取得
      const { data: authData } = await admin.auth.admin.getUserById(userId);
      const artistEmail = authData?.user?.email;

      // 銀行口座の下4桁を取得（entries経由でexternal_user_idを取得）
      const { data: entryForBank } = await admin
        .from("entries")
        .select("external_user_id")
        .eq("user_id", userId)
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
          amountYen: Math.round(totalAmount),
          periodYm,
          itemCount: saleIds.length,
          paidAt: new Date().toISOString(),
          bankAccountLast4,
          manageUrl: `${siteUrl}/mypage`,
        };

        // 内部メールAPI呼び出し
        const emailRes = await fetch(`${siteUrl}/api/send-email/payoutComplete`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-meish-admin-token": process.env.ADMIN_API_TOKEN || "",
          },
          body: JSON.stringify(emailPayload),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text().catch(() => "");
          console.error("[admin/payouts/mark-paid] email send failed:", errText);
        } else {
        }
      } else {
      }
    } catch (emailErr) {
      // メール送信失敗でも振込処理は成功扱い
      console.error("[admin/payouts/mark-paid] email error:", emailErr);
    }

    logAdminAction({ adminEmail, action: "mark_paid", resourceType: "payout", resourceId: payoutId, detail: { userId, updatedCount: saleIds.length, totalAmount } });

    return NextResponse.json({
      ok: true,
      updatedCount: saleIds.length,
      totalAmount,
      payoutId,
    });
  } catch (e: unknown) {
    console.error("[admin/payouts/mark-paid] exception:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message || "Internal server error" },
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
