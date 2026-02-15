// src/app/api/card/form/submit/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { CardFormInputSchema } from "@/lib/card/card.schema";
import {
  insertCardDraft,
  updateCardGenerated,
  updateCardPayload,
} from "@/lib/card/card.db";
import { generateCardFromForm } from "@/lib/card/card.generate";
import { buildCardSessionCookie } from "@/lib/card/requireCardAccess";
import { checkCsrf } from "@/lib/auth/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  try {
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    const existingRequestId =
      typeof json.requestId === "string" ? json.requestId : null;

    // Validate form input
    const parsed = CardFormInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation_error",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    let requestId = existingRequestId;
    let sessionToken: string | undefined;

    // Create new draft if no existing request
    if (!requestId) {
      sessionToken = randomUUID();
      const record = await insertCardDraft({
        email: input.email,
        payload: input,
        sessionToken,
        tier: input.tier,
      });
      requestId = record.id;
    } else {
      // Update existing draft payload
      await updateCardPayload(requestId, input);
    }

    // Generate design + content (preset-based, no OpenAI)
    const { design, content } = generateCardFromForm(input);

    // Save generated result
    const updated = await updateCardGenerated(requestId, { design, content });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "generation_save_failed" },
        { status: 500 },
      );
    }

    const res = NextResponse.json(
      { ok: true, requestId },
      { status: 200 },
    );

    // Set session cookie for new requests
    if (sessionToken) {
      res.headers.append(
        "Set-Cookie",
        buildCardSessionCookie(requestId, sessionToken),
      );
    }

    return res;
  } catch (e: unknown) {
    console.error("[POST /api/card/form/submit] failed:", e);
    const message = e instanceof Error ? e.message : "internal_error";
    return NextResponse.json(
      { ok: false, error: "internal_error", message },
      { status: 500 },
    );
  }
}
