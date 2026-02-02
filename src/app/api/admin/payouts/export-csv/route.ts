// src/app/api/admin/payouts/export-csv/route.ts
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

type BankAccount = {
  external_user_id: string;
  bank_code: string;
  branch_code: string;
  account_type: "futsu" | "toza";
  account_number: string;
  account_name_kana: string;
};

type PendingPayout = {
  user_id: string;
  display_name: string | null;
  pending_amount: number;
};

/**
 * GET /api/admin/payouts/export-csv
 *
 * 振込用CSVをダウンロード
 * クエリパラメータ:
 *   - batch_id: (optional) 特定バッチのみ対象
 *   - format: "zengin" | "simple" (default: simple)
 */
export async function GET(req: NextRequest) {
  try {
    // 認証チェック
    let isAuthorized = false;

    // 方法1: ADMIN_API_TOKEN ヘッダー
    const token = req.headers.get("x-meish-admin-token");
    if (token && process.env.ADMIN_API_TOKEN) {
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

    const admin = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batch_id");
    const format = searchParams.get("format") || "simple";

    // 1. 振込待ち一覧を取得
    const { data: pendingPayouts, error: pendingError } = await (admin as any)
      .from("v_pending_payouts")
      .select("user_id, display_name, pending_amount")
      .order("pending_amount", { ascending: false });

    if (pendingError) {
      console.error("[export-csv] v_pending_payouts error:", pendingError);
      return NextResponse.json(
        { error: "Failed to fetch pending payouts" },
        { status: 500 }
      );
    }

    const payouts = (pendingPayouts ?? []) as PendingPayout[];

    if (payouts.length === 0) {
      return NextResponse.json(
        { error: "No pending payouts" },
        { status: 404 }
      );
    }

    // 2. 各ユーザーのexternal_user_idを取得
    const userIds = payouts.map((p) => p.user_id);
    const { data: entries, error: entriesError } = await admin
      .from("entries")
      .select("user_id, external_user_id")
      .in("user_id", userIds)
      .not("external_user_id", "is", null);

    if (entriesError) {
      console.error("[export-csv] entries error:", entriesError);
      return NextResponse.json(
        { error: "Failed to fetch entries" },
        { status: 500 }
      );
    }

    // user_id -> external_user_id のマップを作成（重複排除）
    const userToExternal = new Map<string, string>();
    for (const entry of entries ?? []) {
      if (entry.external_user_id && !userToExternal.has(entry.user_id)) {
        userToExternal.set(entry.user_id, entry.external_user_id);
      }
    }

    // 3. 銀行口座情報を取得
    const externalIds = Array.from(userToExternal.values());
    const { data: bankAccounts, error: bankError } = await admin
      .from("artists_bank_accounts")
      .select("external_user_id, bank_code, branch_code, account_type, account_number, account_name_kana")
      .in("external_user_id", externalIds);

    if (bankError) {
      console.error("[export-csv] bank accounts error:", bankError);
      return NextResponse.json(
        { error: "Failed to fetch bank accounts" },
        { status: 500 }
      );
    }

    // external_user_id -> 口座情報 のマップ
    const externalToBank = new Map<string, BankAccount>();
    for (const account of (bankAccounts ?? []) as BankAccount[]) {
      externalToBank.set(account.external_user_id, account);
    }

    // 4. 銀行マスタを取得（銀行名を表示するため）
    let bankNames: Record<string, string> = {};
    let branchNames: Record<string, Record<string, string>> = {};

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://me-ish.art";
      const [banksRes, branchesRes] = await Promise.all([
        fetch(`${siteUrl}/data/banks.json`),
        fetch(`${siteUrl}/data/branches.json`),
      ]);

      if (banksRes.ok) {
        const banks = await banksRes.json();
        bankNames = Object.fromEntries(
          banks.map((b: { code: string; name: string }) => [b.code, b.name])
        );
      }

      if (branchesRes.ok) {
        const branches = await branchesRes.json();
        for (const [bankCode, branchList] of Object.entries(branches)) {
          branchNames[bankCode] = Object.fromEntries(
            (branchList as { code: string; name: string }[]).map((br) => [br.code, br.name])
          );
        }
      }
    } catch (e) {
      console.warn("[export-csv] Failed to load bank master data:", e);
    }

    // 5. CSVデータを生成
    const rows: string[][] = [];
    const warnings: string[] = [];

    // ヘッダー行
    if (format === "zengin") {
      // 全銀フォーマット（簡易版）
      rows.push([
        "振込先銀行コード",
        "振込先銀行名",
        "振込先支店コード",
        "振込先支店名",
        "預金種目",
        "口座番号",
        "受取人名",
        "振込金額",
        "備考",
      ]);
    } else {
      // シンプルフォーマット
      rows.push([
        "アーティスト名",
        "振込金額",
        "銀行名",
        "銀行コード",
        "支店名",
        "支店コード",
        "口座種別",
        "口座番号",
        "口座名義",
        "user_id",
      ]);
    }

    for (const payout of payouts) {
      const externalId = userToExternal.get(payout.user_id);
      const bank = externalId ? externalToBank.get(externalId) : null;

      if (!bank) {
        warnings.push(`口座未登録: ${payout.display_name || payout.user_id}`);
        continue;
      }

      const bankName = bankNames[bank.bank_code] || bank.bank_code;
      const branchName = branchNames[bank.bank_code]?.[bank.branch_code] || bank.branch_code;
      const accountTypeLabel = bank.account_type === "futsu" ? "普通" : "当座";
      const accountTypeCode = bank.account_type === "futsu" ? "1" : "2";

      if (format === "zengin") {
        rows.push([
          bank.bank_code,
          bankName,
          bank.branch_code,
          branchName,
          accountTypeCode,
          bank.account_number.padStart(7, "0"),
          bank.account_name_kana,
          String(payout.pending_amount),
          payout.display_name || "",
        ]);
      } else {
        rows.push([
          payout.display_name || "(名前未設定)",
          String(payout.pending_amount),
          bankName,
          bank.bank_code,
          branchName,
          bank.branch_code,
          accountTypeLabel,
          bank.account_number,
          bank.account_name_kana,
          payout.user_id,
        ]);
      }
    }

    // CSVに変換
    const csv = rows
      .map((row) =>
        row.map((cell) => {
          // カンマや改行を含む場合はダブルクォートで囲む
          if (cell.includes(",") || cell.includes("\n") || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(",")
      )
      .join("\n");

    // BOM付きUTF-8（Excel対応）
    const bom = "\uFEFF";
    const csvWithBom = bom + csv;

    // ファイル名
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `meish_payout_${dateStr}.csv`;

    // 警告がある場合はヘッダーに含める
    const headers: HeadersInit = {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    };

    if (warnings.length > 0) {
      headers["X-Payout-Warnings"] = encodeURIComponent(warnings.join("; "));
    }

    return new NextResponse(csvWithBom, { headers });
  } catch (e: any) {
    console.error("[export-csv] exception:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST は 405
export async function POST() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    { status: 405 }
  );
}
