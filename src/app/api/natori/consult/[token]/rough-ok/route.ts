import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { recordClientRoughOk } from "@/features/natori/server/talkRoughService";

export const runtime = "nodejs", dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Records the client's "このラフでOK" for a rough on their own consultation page. */
export async function POST(request: Request, context: Context) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  const { token } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const roughId = body && typeof body === "object" && "roughId" in body && typeof body.roughId === "string" ? body.roughId : null;
  if (!roughId) return NextResponse.json({ error: "invalid_rough" }, { status: 400, headers });
  switch (await recordClientRoughOk(token, roughId)) {
    case "ok": return NextResponse.json({ ok: true }, { headers });
    case "already": return NextResponse.json({ ok: true, already: true }, { headers });
    case "not-found": return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    case "closed": return NextResponse.json({ error: "closed" }, { status: 409, headers });
    default: return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
