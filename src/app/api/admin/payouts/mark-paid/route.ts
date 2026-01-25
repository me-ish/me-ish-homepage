// src/app/api/admin/payouts/mark-paid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/isAdmin";

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

    // 方法1: ADMIN_API_TOKEN ヘッダー
    const token = req.headers.get("x-meish-admin-token");
    if (token && process.env.ADMIN_API_TOKEN) {
      // タイミングセーフ比較
      const expected = process.env.ADMIN_API_TOKEN;
      if (token.length === expected.length) {
        let diff = 0;
        for (let i = 0; i < token.length; i++) {
          diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
        }
        if (diff === 0) isAuthorized = true;
      }
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

    // admin_mark_sales_paid RPC を呼び出し
    const { data, error } = await admin.rpc("admin_mark_sales_paid", {
      p_user_id: userId,
    });

    if (error) {
      console.error("[admin/payouts/mark-paid] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to update payout status" },
        { status: 500 }
      );
    }

    // RPC の戻り値を取得
    const result = Array.isArray(data) && data[0] ? data[0] : data;
    const updatedCount = result?.updated_count ?? 0;
    const totalAmount = result?.total_amount ?? 0;

    console.log("[admin/payouts/mark-paid] SUCCESS:", {
      userId,
      updatedCount,
      totalAmount,
    });

    return NextResponse.json({
      ok: true,
      updatedCount,
      totalAmount,
    });
  } catch (e: any) {
    console.error("[admin/payouts/mark-paid] exception:", e);
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
