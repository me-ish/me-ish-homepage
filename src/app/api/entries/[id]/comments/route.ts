// src/app/api/entries/[id]/comments/route.ts
// 作品コメントAPI（一覧取得・投稿）
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// entry_commentsテーブルの型（マイグレーション適用後に自動生成される型に置き換え可能）
type EntryComment = {
  id: string;
  entry_id: number;
  user_id: string;
  body: string;
  author_name: string;
  deleted_at: string | null;
  created_at: string;
};

/**
 * GET /api/entries/[id]/comments
 * Query: ?limit=50&offset=0
 *
 * コメント一覧を取得
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    if (isNaN(entryId) || entryId <= 0) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const supabase = (await createClient()) as SupabaseClient;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Number(url.searchParams.get("offset")) || 0;

    // 作品情報を取得（オーナー判定用）
    const { data: entry } = await supabase
      .from("entries")
      .select("user_id")
      .eq("id", entryId)
      .single();

    // コメント取得
    const { data: comments, error, count } = await supabase
      .from("entry_comments")
      .select("id, body, author_name, user_id, created_at", { count: "exact" })
      .eq("entry_id", entryId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[comments] fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    const formatted = ((comments ?? []) as EntryComment[]).map((c) => ({
      id: c.id,
      body: c.body,
      author_name: c.author_name,
      user_id: c.user_id,
      created_at: c.created_at,
      is_own: user?.id === c.user_id,
      is_entry_owner: entry?.user_id === c.user_id,
    }));

    return NextResponse.json({
      comments: formatted,
      total: count ?? 0,
      hasMore: (count ?? 0) > offset + limit,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    console.error("[comments] exception:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/entries/[id]/comments
 * Body: { body: string }
 *
 * コメントを投稿（認証必須）
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    if (isNaN(entryId) || entryId <= 0) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const supabase = (await createClient()) as SupabaseClient;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let body: string;
    try {
      const json = await req.json();
      body = (json.body ?? "").trim();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!body || body.length < 1 || body.length > 1000) {
      return NextResponse.json(
        { error: "Comment must be 1-1000 characters" },
        { status: 400 }
      );
    }

    // 作品情報を取得（存在確認 & オーナー判定用）
    const { data: entry, error: entryError } = await supabase
      .from("entries")
      .select("user_id, confirmed, display_ready")
      .eq("id", entryId)
      .single();

    if (entryError || !entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (!entry.confirmed || !entry.display_ready) {
      return NextResponse.json(
        { error: "Entry is not public" },
        { status: 403 }
      );
    }

    // ユーザーのdisplay_nameを取得
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const authorName = profile?.display_name || "Anonymous";

    // コメント作成
    const { data: comment, error: insertError } = await supabase
      .from("entry_comments")
      .insert({
        entry_id: entryId,
        user_id: user.id,
        body,
        author_name: authorName,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[comments] insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    const insertedComment = comment as EntryComment;

    return NextResponse.json({
      comment: {
        id: insertedComment.id,
        body: insertedComment.body,
        author_name: insertedComment.author_name,
        user_id: insertedComment.user_id,
        created_at: insertedComment.created_at,
        is_own: true,
        is_entry_owner: entry.user_id === user.id,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    console.error("[comments] exception:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
