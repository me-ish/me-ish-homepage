// /src/app/api/files/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyCertToken } from "@/lib/coa/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = process.env.SUPABASE_BUCKET || "artworks";
const FOLDER = process.env.FILES_FINAL_FOLDER || "final";
const TTL = Number(process.env.CERT_SIGNED_URL_TTL_SECONDS || 300);
const ALLOW_NFT = process.env.ALLOW_OFFCHAIN_DOWNLOAD_FOR_NFT === "1";

/** FOLDER 内でファイル名(拡張子違いも含む)を探す */
async function findObjectPath(
  folder: string,
  baseNameOrStem: string,
  admin = supabaseAdmin()
) {
  // baseNameOrStem が "aaa/bbb.png" のようにパス込みだった場合は最後の名前にする
  const justName = baseNameOrStem.split("/").pop() || baseNameOrStem;

  // stem と ext を分離
  const dot = justName.lastIndexOf(".");
  const stem = dot > 0 ? justName.slice(0, dot) : justName;
  const extFromDb = dot > 0 ? justName.slice(dot + 1).toLowerCase() : "";

  // 優先的に試す拡張子の順序
  const exts: string[] = [
    extFromDb,
    "zip",
    "png",
    "jpg",
    "jpeg",
    "webp",
  ].filter(Boolean);

  // 探索するディレクトリ候補
  const dirs = [FOLDER, `${FOLDER}/${FOLDER}`, `${FOLDER}/artworks`, `${FOLDER}/artwork`];

  for (const dir of dirs) {
    // まず stem で list（search は部分一致）
    const { data: items, error } = await admin.storage.from(BUCKET).list(dir, {
      limit: 1000,
      search: stem,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) continue;
    if (!items?.length) continue;

    // 1) 完全一致を最優先
    const exact = items.find((o) => o.name === justName);
    if (exact) return `${dir}/${exact.name}`;

    // 2) stem + 任意の拡張子 で一致（.jpg⇄.png ゆらぎ対策）
    for (const ext of exts) {
      const cand = `${stem}.${ext}`;
      const hit = items.find((o) => o.name.toLowerCase() === cand.toLowerCase());
      if (hit) return `${dir}/${hit.name}`;
    }

    // 3) stem から始まるファイルを 1 件拾う（万一の保険）
    const any = items.find((o) => o.name.startsWith(stem + "."));
    if (any) return `${dir}/${any.name}`;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("certToken") || "";
  const ver = await verifyCertToken(token);
  if (!ver.ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // entries から最小限の情報を取得
  const { data: entry, error: e1 } = await admin
    .from("entries")
    .select("id, sale_type, file_name")
    .eq("id", ver.entryId)
    .single();

  if (e1 || !entry) {
    return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
  }

  // NFT ならオフチェーンDLを遮断（許可したい場合は env で）
  const rawSaleType = (entry as any).sales_type ?? entry.sale_type ?? "normal";
  const saleType = String(rawSaleType).toLowerCase();
  if (saleType === "nft" && !ALLOW_NFT) {
    return NextResponse.json({ error: "offchain_download_disabled_for_nft" }, { status: 403 });
  }

  // Storage 上の実ファイルを解決（拡張子ゆらぎ/下位フォルダも考慮）
  const objectPath =
    (await findObjectPath(FOLDER, entry.file_name || String(ver.entryId))) || null;

  if (!objectPath) {
    return NextResponse.json(
      {
        error: "asset_not_found",
        tried: {
          bucket: BUCKET,
          folder: FOLDER,
          entryId: ver.entryId,
          file_name: entry.file_name ?? null,
        },
      },
      { status: 404 }
    );
  }

  // ダウンロード名（実ファイル名 or DB の file_name を優先）
  const downloadName =
    entry.file_name?.trim() || objectPath.split("/").pop() || `${ver.entryId}.bin`;

  // 署名付きURLで 302 リダイレクト
  const { data: signed, error: e2 } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, TTL, { download: downloadName });

  if (e2 || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "sign_error", detail: e2?.message, path: `${BUCKET}/${objectPath}` },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
