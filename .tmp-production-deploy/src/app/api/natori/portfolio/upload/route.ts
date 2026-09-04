// api/natori/portfolio/upload/route.ts
// /natori/portfolio 編集画面からの画像アップロード。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import {
  canEditNatoriPortfolio,
  uploadPortfolioImage,
} from "@/features/natori/server/portfolioSiteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  if (!(await canEditNatoriPortfolio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file_missing" }, { status: 400 });
    }

    const result = await uploadPortfolioImage(file);
    switch (result.kind) {
      case "invalid-type":
        return NextResponse.json({ error: "invalid_mime" }, { status: 400 });
      case "too-large":
        return NextResponse.json({ error: "file_too_large" }, { status: 400 });
      case "upload-error":
        return NextResponse.json({ error: "upload_failed" }, { status: 500 });
      case "ok":
        return NextResponse.json({ ok: true, url: result.url });
    }
  } catch (err) {
    console.error("[natori-portfolio/upload] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
