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

async function findExactPath(
  admin: ReturnType<typeof supabaseAdmin>,
  folder: string,
  filename: string
) {
  const { data, error } = await admin.storage.from(BUCKET).list(folder, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
    search: filename,
  });
  if (!error && data?.some((o) => o.name === filename)) {
    return `${folder}/${filename}`;
  }
  return null;
}

async function resolveObjectPath(
  admin: ReturnType<typeof supabaseAdmin>,
  entryId: number,
  fileNameFromDb?: string | null
) {
  const trimmed = (fileNameFromDb || "").trim();
  const bases: string[] = [];
  if (trimmed) bases.push(trimmed);

  const baseId = String(entryId);
  ["zip", "png", "jpg", "jpeg", "webp"].forEach((ext) => {
    bases.push(`${baseId}.${ext}`);
  });

  const folders = [FOLDER, `${FOLDER}/${FOLDER}`, `${FOLDER}/artworks`, `${FOLDER}/artwork`];

  for (const fn of bases) {
    for (const dir of folders) {
      const p = await findExactPath(admin, dir, fn);
      if (p) return p;
    }
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

  // ★ 'sales_type' は SELECT に含めない（存在しないため）
  const { data: entry, error: e1 } = await admin
    .from("entries")
    .select("id, sale_type, file_name")
    .eq("id", ver.entryId)
    .single();

  if (e1 || !entry) {
    return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
  }

  // 将来 'sales_type' 列が増える可能性に備え、any 経由で両方を見る
  const rawSaleType = (entry as any).sales_type ?? entry.sale_type ?? "normal";
  const saleType = String(rawSaleType).toLowerCase();

  if (saleType === "nft" && !ALLOW_NFT) {
    return NextResponse.json({ error: "offchain_download_disabled_for_nft" }, { status: 403 });
  }

  const objectPath = await resolveObjectPath(admin, ver.entryId, entry.file_name);
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

  const downloadName =
    entry.file_name?.trim() ||
    `${ver.entryId}.${objectPath.split(".").pop() || "bin"}`;

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
