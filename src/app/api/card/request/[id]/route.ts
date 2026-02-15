// src/app/api/card/request/[id]/route.ts
import { NextResponse } from "next/server";
import { findCardRequest } from "@/lib/card/card.db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const rec = await findCardRequest(params.id);

    if (!rec) {
      return NextResponse.json(
        { ok: true, status: "pending" },
        { status: 200 },
      );
    }

    if (rec.status === "error") {
      return NextResponse.json(
        {
          ok: false,
          status: "error",
          error: rec.error ?? "generation_failed",
        },
        { status: 200 },
      );
    }

    if (rec.design && rec.content) {
      return NextResponse.json(
        { ok: true, status: "ready" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { ok: true, status: "pending" },
      { status: 200 },
    );
  } catch (e: unknown) {
    console.error("[CARD_REQUEST_GET_ERROR]", e);
    return NextResponse.json(
      { ok: false, status: "error", error: "internal_error" },
      { status: 200 },
    );
  }
}
