import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { getClientConsultation, sendClientConsultation } from "@/features/natori/server/consultationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  const result = await getClientConsultation(token);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(request: Request, context: Context) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const { token } = await context.params;
  const input = await request.json().catch(() => null) as { body?: unknown } | null;
  if (typeof input?.body !== "string") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = await sendClientConsultation(token, input.body);
  if (result === "invalid") return NextResponse.json({ error: "本文は1〜4000文字で入力してください" }, { status: 400 });
  if (result === "not-found") return NextResponse.json({ error: "このリンクは無効か、相談は終了しています" }, { status: 404 });
  if (result === "db-error") return NextResponse.json({ error: "保存できませんでした。もう一度お試しください" }, { status: 500 });
  return NextResponse.json({ ok: true, notificationFailed: result === "notification-failed" });
}
