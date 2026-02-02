// app/admin/api/entries/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/isAdmin";
import { EntryListQuery } from "@/lib/schemas/entry";

export const revalidate = 0;

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const qp = Object.fromEntries(url.searchParams.entries());
  const parsed = EntryListQuery.safeParse(qp);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { gallery, status, sortKey, sortOrder, keyword } = parsed.data;

  const admin = supabaseAdmin();

  // ✅ entries に紐づくジョブ（entry_processing_jobs）を同時取得
  // - PostgREST のリレーション埋め込み（FK: entry_processing_jobs.entry_id -> entries.id が前提）
  // - entry_id UNIQUE なので配列は 0 or 1 件想定
  let q = admin
    .from("entries")
    .select("*, entry_processing_jobs(*)")
    .order(sortKey, { ascending: sortOrder === "asc" });

  if (gallery !== "all") q = q.eq("gallery_type", gallery);
  if (status === "unreviewed") q = q.is("confirmed", null);
  else if (status === "approved") q = q.eq("confirmed", true);
  else if (status === "rejected") q = q.eq("confirmed", false);
  else if (status === "processing") q = q.eq("confirmed", true).eq("display_ready", false);

  if (keyword && keyword.trim()) {
    const kw = keyword.trim();
    q = q.or(`title.ilike.%${kw}%,artist_name.ilike.%${kw}%`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "list_failed" }, { status: 500 });

  const rows = (data ?? []).map((e: any) => {
    const embedded = e.entry_processing_jobs;
    const processing_job = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded ?? null;

    // ✅ processed は legacy 互換の補助値として残す（UIは display_ready + job.status を正とする）
    // - storage final/ のlistは重い＆上限ありなので廃止
    // - ただし “final/{stem}.png” アップ運用でも processed が true になるように display_ready / job.succeeded を採用
    const processed = Boolean(e.display_ready) || processing_job?.status === "succeeded";

    // 余計な埋め込み配列は返さない（フロントのEntry型と揃える）
    const { entry_processing_jobs, ...rest } = e;

    return {
      ...rest,
      processed,
      processing_job,
    };
  });

  return NextResponse.json(rows);
}
