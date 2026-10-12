// api/natori/portfolio/video-upload/route.ts
// /natori/portfolio 編集画面からの制作過程の動画ファイルのアップロード準備。
// 動画そのものはここを通さない。署名付きアップロードURLを返し、ブラウザから Storage へ直接上げる。
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { canEditNatoriPortfolio } from "@/features/natori/server/portfolioSiteService";
import { prepareProcessVideoUpload } from "@/features/natori/server/portfolioProcessVideoUploadService";
import {NATORI_MANAGEMENT_ASSET_BUCKET} from "@/features/natori/lib/portfolioAssetUrl";
import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  sizeBytes: z.number().int().positive(),
  contentType: z.string().max(100),
});

export const POST=withNatoriManagement("portfolio-video.prepare",true,async (req: Request)=> {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  if (!(await canEditNatoriPortfolio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = requestSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const result = await prepareProcessVideoUpload(body.data);
    switch (result.kind) {
      case "invalid-type":
        return NextResponse.json({ error: "invalid_mime" }, { status: 400 });
      case "empty":
        return NextResponse.json({ error: "file_empty" }, { status: 400 });
      case "too-large":
        return NextResponse.json({ error: "file_too_large" }, { status: 400 });
      case "storage-error":
        return NextResponse.json({ error: "storage_error" }, { status: 500 });
      case "ok":
        return NextResponse.json({
          ok: true,
          path: result.path,
          token: result.token,
          assetId:result.assetId,
          bucket:NATORI_MANAGEMENT_ASSET_BUCKET,
          url: result.url,
        });
    }
  } catch (err) {
    console.error("[natori-portfolio/video-upload] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
});
