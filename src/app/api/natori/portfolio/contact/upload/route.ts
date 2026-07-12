// api/natori/portfolio/contact/upload/route.ts
// /natori/portfolio ご依頼フォームのキャラクター資料（参考画像）アップロード。
// 公開フォームから呼ばれるため認可はせず、CSRFヘッダーとIPレート制限で保護する。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import { uploadPortfolioReferenceImage } from "@/features/natori/server/portfolioSiteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  // 1回の依頼で最大5枚 + やり直しを見込んだ枠
  const ip = getIpFromRequest(req);
  const rl = checkRateLimit(`natori-portfolio-ref-upload:${ip}`, {
    limit: 20,
    windowMs: 600_000,
  });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file_missing" }, { status: 400 });
    }

    const result = await uploadPortfolioReferenceImage(file);
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
    console.error("[natori-portfolio/contact-upload] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
