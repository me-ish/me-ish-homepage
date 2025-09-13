import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyCertToken } from "@/lib/coa/server";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
const token = req.nextUrl.searchParams.get("certToken") || "";
const ver = await verifyCertToken(token);
if (!ver.ok) return NextResponse.json({ error: "invalid token" }, { status: 401 });


// entriesテーブル or 別メタから filePath を解決する想定（例: final/<entryId>.zip）
const filePath = `final/${ver.entryId}.zip`;
const bucket = process.env.SUPABASE_BUCKET || "artworks";
const ttl = Number(process.env.CERT_SIGNED_URL_TTL_SECONDS || 300);


const s = supabaseAdmin();
const { data, error } = await s.storage.from(bucket).createSignedUrl(filePath, ttl);
if (error || !data?.signedUrl) {
return NextResponse.json({ error: "sign error" }, { status: 500 });
}
return NextResponse.redirect(data.signedUrl, { status: 302 });
}