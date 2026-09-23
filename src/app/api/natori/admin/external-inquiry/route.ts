import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import { createExternalNatoriInquiry } from "@/features/natori/server/externalInquiryService";

export const runtime = "nodejs";

const schema = z.strictObject({
  clientName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  clientEmail: z.union([z.literal(""), z.email().max(254)]),
  source: z.enum(["DM", "Gmail・メール", "他プラットフォーム", "その他"]),
  note: z.string().max(4000),
});

export async function POST(request: Request) {
  if (!(await canUseNatoriManagement())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await createExternalNatoriInquiry(parsed.data);
  if (result.kind === "no-owner") return NextResponse.json({ error: "no_owner" }, { status: 503 });
  if (result.kind !== "ok") return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, projectId: result.projectId });
}
