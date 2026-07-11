// api/natori/portfolio/content/route.ts
// /natori/portfolio の掲載内容の取得・保存。業務ロジックは portfolioSiteService に集約。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import {
  canEditNatoriPortfolio,
  loadPortfolioContent,
  savePortfolioContent,
} from "@/features/natori/server/portfolioSiteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 本番で Supabase への fetch が Next のデータキャッシュに乗り、編集後も古い
// 掲載内容を返し続ける事象があったため、fetch 単位でもキャッシュを禁止する。
// （編集画面がここから古い内容を読み込んで保存すると、他の編集を巻き戻して
// しまうため、このルートは常に最新を返す必要がある）
export const fetchCache = "force-no-store";

export async function GET() {
  // 掲載内容は公開ページと同じものなので認可不要
  const content = await loadPortfolioContent();
  return NextResponse.json({ content });
}

export async function PUT(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  if (!(await canEditNatoriPortfolio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { content?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await savePortfolioContent(body.content);
  switch (result.kind) {
    case "invalid":
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    case "db-error":
      return NextResponse.json({ error: "Failed to save content" }, { status: 500 });
    case "ok":
      return NextResponse.json({ ok: true, content: result.content });
  }
}
