// src/app/api/cert/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // サービスロールキーを使うので Node 実行

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = process.env.SUPABASE_BUCKET!; // 例: 'deliveries'

// 例: /api/cert/download?entry=123&t=xxxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get("entry");
    if (!entryId) {
      return NextResponse.json({ ok: false, error: "missing entry id" }, { status: 400 });
    }

    // entries から必要情報を取得（title, artist_name は将来のログ/検証用）
    const { data: entry, error } = await supabase
      .from("entries")
      .select("id, file_name")
      .eq("id", Number(entryId))
      .single();

    if (error || !entry) {
      return NextResponse.json({ ok: false, error: "entry not found" }, { status: 404 });
    }

    // パス決定：file_name にスラッシュ含むならそれを優先、無ければ <id>/<file_name>
    const filePath: string = entry.file_name?.includes("/")
      ? entry.file_name
      : `${entry.id}/${entry.file_name}`;

    // 5分だけ有効なサイン付きURLを発行
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 5);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: "file not available" }, { status: 404 });
    }

    // 302でリダイレクト（ブラウザは即ダウンロード開始）
    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "download failed" }, { status: 500 });
  }
}
