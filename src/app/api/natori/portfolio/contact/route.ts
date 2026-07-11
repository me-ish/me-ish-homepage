// api/natori/portfolio/contact/route.ts
// /natori/portfolio のご依頼フォーム送信。業務ロジックは portfolioContactService に集約。
import { NextResponse } from "next/server";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import {
  isPortfolioContactConfigured,
  portfolioContactSchema,
  sendPortfolioContactEmail,
} from "@/features/natori/server/portfolioContactService";
import { createInquiryProject } from "@/features/natori/server/inquiryProjectService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const ip = getIpFromRequest(req);
  const rl = checkRateLimit(`natori-portfolio-contact:${ip}`, {
    limit: 3,
    windowMs: 600_000,
  });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = portfolioContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 蜜壺：値が入っていたら成功風レスポンスで終了（案件化も送信もしない）
    if (parsed.data.website && parsed.data.website.trim() !== "") {
      return NextResponse.json({ success: true, mailed: false, spam: true });
    }

    // Phase 1: フォーム送信を案件（inquiry）として起票する。これを一次的な
    // 永続化とし、メールは通知として扱う。どちらか一方でも成功すれば依頼は
    // 失われないので success を返す。
    let caseCreated = false;
    try {
      const result = await createInquiryProject(parsed.data);
      caseCreated = result.kind === "ok";
      if (!caseCreated) {
        console.error("[natori-portfolio-contact] case creation failed:", result.kind);
      }
    } catch (caseErr) {
      console.error("[natori-portfolio-contact] case creation threw:", caseErr);
    }

    let mailed = false;
    if (isPortfolioContactConfigured()) {
      const sent = await sendPortfolioContactEmail(parsed.data, ip);
      mailed = sent.mailed;
    } else {
      console.error("[natori-portfolio-contact] mail skipped: RESEND_API_KEY not set");
    }

    if (!caseCreated && !mailed) {
      return NextResponse.json({ error: "inquiry not recorded" }, { status: 500 });
    }
    return NextResponse.json({ success: true, mailed, caseCreated });
  } catch (err) {
    console.error("[natori-portfolio-contact] Unhandled Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
