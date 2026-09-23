import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { renewClientConsultationLink } from "@/features/natori/server/consultationService";

export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: Context) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const { token } = await context.params;
  const result = await renewClientConsultationLink(token);
  if (result === "not-found") return NextResponse.json({ error: "このリンクは利用できません" }, { status: 404 });
  if (result === "throttled") return NextResponse.json({ error: "少し時間をおいて再度お試しください" }, { status: 429 });
  if (result === "mail-error") return NextResponse.json({ error: "メールを送れませんでした。時間をおいてお試しください" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
