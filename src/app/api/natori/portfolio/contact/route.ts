// api/natori/portfolio/contact/route.ts
// /natori/portfolio のご依頼フォーム送信。業務ロジックは portfolioContactService に集約。
import { NextResponse } from "next/server";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import {
  isPortfolioContactConfigured,
  portfolioContactSchema,
  sendPortfolioContactEmail,
} from "@/features/natori/server/portfolioContactService";

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

  if (!isPortfolioContactConfigured()) {
    return NextResponse.json(
      { error: "server misconfig: RESEND_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = portfolioContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 蜜壺：値が入っていたら成功風レスポンスで終了（送信しない）
    if (parsed.data.website && parsed.data.website.trim() !== "") {
      return NextResponse.json({ success: true, mailed: false, spam: true });
    }

    const { mailed } = await sendPortfolioContactEmail(parsed.data, ip);
    if (!mailed) {
      return NextResponse.json({ error: "mail send failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true, mailed });
  } catch (err) {
    console.error("[natori-portfolio-contact] Unhandled Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
