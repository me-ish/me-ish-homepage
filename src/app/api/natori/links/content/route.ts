// api/natori/links/content/route.ts
// /natori/links の掲載内容の取得・保存。業務ロジックは linksSiteService に集約。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  loadNatoriLinksContent,
  saveNatoriLinksContent,
} from "@/features/natori/server/linksSiteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 編集画面が古い内容を読み込んで保存すると他の編集を巻き戻すため、常に最新を返す
export const fetchCache = "force-no-store";

export async function GET() {
  // 掲載内容は公開ページと同じものなので認可不要
  const content = await loadNatoriLinksContent();
  return NextResponse.json({ content });
}

export async function PUT(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await saveNatoriLinksContent(body.content);
  switch (result.kind) {
    case "invalid":
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    case "db-error":
      return NextResponse.json({ error: "Failed to save content" }, { status: 500 });
    case "ok":
      return NextResponse.json({ ok: true, content: result.content });
  }
}
