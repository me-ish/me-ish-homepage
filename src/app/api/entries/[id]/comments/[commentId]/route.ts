// src/app/api/entries/[id]/comments/[commentId]/route.ts
// 個別コメントAPI（削除）
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  id: string;
  commentId: string;
};

// entry_commentsテーブルの型（マイグレーション適用後に自動生成される型に置き換え可能）
type EntryComment = {
  user_id: string;
  entry_id: number;
  deleted_at: string | null;
};

/**
 * DELETE /api/entries/[id]/comments/[commentId]
 *
 * コメントをソフト削除（投稿者 or 作品オーナーのみ）
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id, commentId } = await params;
    const entryId = Number(id);

    if (isNaN(entryId) || entryId <= 0) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    if (!commentId) {
      return NextResponse.json(
        { error: "Invalid comment ID" },
        { status: 400 }
      );
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

    // コメント情報を取得
    const { data: commentData, error: commentError } = await supabase
      .from("entry_comments")
      .select("user_id, entry_id, deleted_at")
      .eq("id", commentId)
      .single();

    if (commentError || !commentData) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const comment = commentData as EntryComment;

    if (comment.entry_id !== entryId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.deleted_at) {
      return NextResponse.json(
        { error: "Comment already deleted" },
        { status: 400 }
      );
    }

    // 作品情報を取得（オーナー判定用）
    const { data: entry } = await supabase
      .from("entries")
      .select("user_id")
      .eq("id", entryId)
      .single();

    // 権限チェック: コメント投稿者 または 作品オーナー
    const isCommentOwner = comment.user_id === user.id;
    const isEntryOwner = entry?.user_id === user.id;

    if (!isCommentOwner && !isEntryOwner) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // ソフト削除
    const { error: updateError } = await supabase
      .from("entry_comments")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq("id", commentId);

    if (updateError) {
      console.error("[comments] delete error:", updateError);
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    console.error("[comments] exception:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
