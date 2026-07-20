// src/app/api/card/save/[id]/route.ts
import { NextResponse } from "next/server";
import { CardContentSchema } from "@/lib/card/card.schema";
import { publishCard, findCardRequest } from "@/lib/card/card.db";
import { requireCardRequestAccess } from "@/lib/card/requireCardAccess";
import { checkCsrf } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { id: string };

export const dynamic = "force-dynamic";

export async function POST(req: Request, props: { params: Promise<Params> }) {
  const params = await props.params;
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const id = params.id;

  try {
    // 1) Ownership check
    const access = await requireCardRequestAccess(id, req);
    if (!access.ok) return access.response;
    const rec = access.rec;

    // 2) Parse request body
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400 },
      );
    }

    // 3) Validate content
    if (!("content" in json)) {
      return NextResponse.json(
        { ok: false, error: "missing_content" },
        { status: 400 },
      );
    }

    const parsed = CardContentSchema.safeParse(json.content);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_content", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const content = parsed.data;

    // 4) Publish (all features free)
    const { record, publicId, publicSlug } = await publishCard(id, content);

    if (!record || !publicSlug) {
      return NextResponse.json(
        { ok: false, error: "publish_failed" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        publicId: record.publicId,
        publicSlug: record.publicSlug,
        status: record.status,
      },
      { status: 200 },
    );
  } catch (e: unknown) {
    console.error("[card/save] unexpected_error", { id, error: e });
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
