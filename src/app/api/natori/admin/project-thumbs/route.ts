import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  listNatoriProjectThumbs,
  uploadNatoriProjectThumb,
} from "@/features/natori/server/projectThumbsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listNatoriProjectThumbs();
  if (result.kind === "storage-error") {
    return NextResponse.json({ error: "Failed to list thumbnails" }, { status: 500 });
  }
  return NextResponse.json({ thumbs: result.thumbs });
}

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const projectId = form.get("projectId");
    const file = form.get("file");
    if (typeof projectId !== "string" || !projectId.trim()) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file_missing" }, { status: 400 });
    }

    const result = await uploadNatoriProjectThumb(projectId, file);
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
    console.error("[natori-project-thumbs] error", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
