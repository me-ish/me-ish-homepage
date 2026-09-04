// src/app/api/card/draft/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { insertCardDraft } from "@/lib/card/card.db";
import type { CardFormInput } from "@/lib/card/card.schema";
import { buildCardSessionCookie } from "@/lib/card/requireCardAccess";
import { checkCsrf } from "@/lib/auth/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  try {
    const json = await req.json().catch(() => null);

    if (!json?.email || typeof json.email !== "string") {
      return NextResponse.json(
        { ok: false, error: "email_required" },
        { status: 400 },
      );
    }

    const payload: Partial<CardFormInput> = {
      email: json.email,
      name: typeof json.name === "string" ? json.name : "",
    };

    const sessionToken = randomUUID();

    const record = await insertCardDraft({
      email: json.email,
      payload,
      sessionToken,
      tier: json.tier === "premium" ? "premium" : "free",
    });

    const res = NextResponse.json(
      { ok: true, requestId: record.id },
      { status: 200 },
    );
    res.headers.append(
      "Set-Cookie",
      buildCardSessionCookie(record.id, sessionToken),
    );
    return res;
  } catch (e: unknown) {
    console.error("[POST /api/card/draft] failed:", e);
    const message = e instanceof Error ? e.message : "internal_error";
    return NextResponse.json(
      { ok: false, error: "internal_error", message },
      { status: 500 },
    );
  }
}
