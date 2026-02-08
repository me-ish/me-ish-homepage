// src/app/api/entries/[id]/view/route.ts
// 作品閲覧イベント記録API
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/entries/[id]/view
 * Body: { sessionId?: string, userId?: string }
 *
 * 閲覧イベントを記録する。
 * - sessionId: クライアント側で生成したセッションID（重複防止用）
 * - userId: ログインユーザーのID（任意）
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    if (isNaN(entryId) || entryId <= 0) {
      return NextResponse.json(
        { error: "Invalid entry ID" },
        { status: 400 }
      );
    }

    let sessionId: string | null = null;
    let userId: string | null = null;

    try {
      const body = await req.json();
      sessionId = body.sessionId || null;
      userId = body.userId || null;
    } catch {
      // bodyがない場合は無視
    }

    const admin = supabaseAdmin();

    // エントリの公開状態を確認（非公開作品へのビュー記録を防止）
    const { data: entry } = await admin
      .from("entries")
      .select("id")
      .eq("id", entryId)
      .eq("confirmed", true)
      .eq("display_ready", true)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      );
    }

    // entry_view_eventsにINSERT（重複はUNIQUEインデックスで防止）
    const { error } = await admin
      .from("entry_view_events")
      .insert({
        entry_id: entryId,
        session_id: sessionId,
        viewer_user_id: userId,
      });

    if (error) {
      // 重複エラー（23505）は成功扱い
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      // 外部キーエラー（entry_idが存在しない）
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Entry not found" },
          { status: 404 }
        );
      }
      console.error("[entries/view] insert error:", error);
      return NextResponse.json(
        { error: "Failed to record view" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[entries/view] exception:", e);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GETは405
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    { status: 405 }
  );
}
