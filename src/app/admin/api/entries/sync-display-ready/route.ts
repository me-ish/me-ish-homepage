// src/app/admin/api/entries/sync-display-ready/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/isAdmin";
import path from "node:path";

export const revalidate = 0;

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) return null;
  return user;
}

function ensureTrailingSlash(u: string) {
  return u.endsWith("/") ? u : `${u}/`;
}

export async function POST() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = supabaseAdmin();

  // ✅ confirmed=true で display_ready=false のものだけ同期対象
  // （必要なら confirmed 条件を外してもOKだが、運用上はこれが安全）
  const { data: targets, error: qErr } = await admin
    .from("entries")
    .select("id,file_name")
    .eq("confirmed", true)
    .eq("display_ready", false)
    .limit(200);

  if (qErr) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  const rows = targets ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, skipped: 0 });
  }

  // public URL を deterministic に組む（list を毎回叩かない＝高速）
  // 注意: NEXT_PUBLIC_SUPABASE_URL が無い環境なら SUPABASE_URL を用意しておく
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  if (!base) {
    return NextResponse.json({ error: "missing_supabase_url_env" }, { status: 500 });
  }
  const SUPABASE_URL = ensureTrailingSlash(base);

  let updated = 0;
  let skipped = 0;

  // ✅ “実在チェック”をしたいなら list(search) を使う
  // ただし負荷が上がるので、まずは deterministic URL で更新で良い（運用上はColabが正）
  const DO_EXISTENCE_CHECK = false;

  for (const e of rows) {
    const fileName = (e as any).file_name as string | null;
    if (!fileName) {
      skipped++;
      continue;
    }

    const stem = path.parse(fileName).name; // 1769..._usachan
    const finalName = `${stem}.png`;
    const objectPath = `artworks/final/${finalName}`;
    const publicUrl = `${SUPABASE_URL}storage/v1/object/public/${objectPath}`;

    if (DO_EXISTENCE_CHECK) {
      const { data: listed, error: lErr } = await admin.storage
        .from("artworks")
        .list("final", { limit: 10, search: finalName });

      if (lErr || !(listed ?? []).some((x) => x.name === finalName)) {
        skipped++;
        continue;
      }
    }

    const { error: uErr } = await admin
      .from("entries")
      .update({ image_url: publicUrl, display_ready: true })
      .eq("id", (e as any).id);

    if (uErr) {
      skipped++;
      continue;
    }
    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
