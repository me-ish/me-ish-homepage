import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { openTalkLink } from "@/features/natori/server/talkOpenService";

export const runtime = "nodejs", dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Mints a fresh quote / delivery link for a card on the consultation page. */
export async function POST(request: Request, context: Context) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  const { token } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const target = body && typeof body === "object" && "target" in body ? body.target : null;
  if (target !== "quote" && target !== "delivery") return NextResponse.json({ error: "invalid_target" }, { status: 400, headers });
  const result = await openTalkLink(token, target);
  switch (result.kind) {
    case "ok": return NextResponse.json({ path: result.path }, { headers });
    case "not-found": return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    case "unavailable": return NextResponse.json({ error: "unavailable" }, { status: 409, headers });
    case "throttled": return NextResponse.json({ error: "throttled" }, { status: 429, headers });
    default: return NextResponse.json({ error: "db_error" }, { status: 503, headers });
  }
}
