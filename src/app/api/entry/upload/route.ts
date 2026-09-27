import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest } from "@/lib/rateLimit";
import { entryUploadRequest } from "@/lib/entryUpload";
import {
  finishEntryUpload,
  signEntryUpload,
} from "@/lib/server/entryUploadService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "no-store" };

async function readBody(request: Request): Promise<unknown> {
  if (
    !request.body ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return null;
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return NextResponse.json(
      { error: "送信元を確認できません。ページを開き直してください" },
      { status: 403, headers },
    );
  }
  const input = entryUploadRequest.safeParse(await readBody(request));
  if (!input.success)
    return NextResponse.json(
      { error: "画像の形式・容量を確認してください" },
      { status: 400, headers },
    );
  const limit = await checkRateLimit(
    `entry-upload:${input.data.action}:${getIpFromRequest(request)}`,
    {
      limit: input.data.action === "sign" ? 5 : 15,
      windowMs: 600_000,
    },
  );
  if (!limit.allowed)
    return NextResponse.json(
      { error: "送信が集中しています。少し待って再度お試しください" },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  try {
    const result =
      input.data.action === "sign"
        ? await signEntryUpload({
            mimeType: input.data.mimeType,
            sizeBytes: input.data.sizeBytes,
            sha256: input.data.sha256,
          })
        : await finishEntryUpload(input.data.receipt);
    if (result.kind === "invalid")
      return NextResponse.json(
        {
          error:
            "画像を確認できません。PNG/JPEG・10MB以内・短辺960px以上・長辺3000px以内の画像を選び直してください",
        },
        { status: 400, headers },
      );
    if (result.kind === "storage-error")
      return NextResponse.json(
        { error: "画像を保存できませんでした。時間をおいて再度お試しください" },
        { status: 503, headers },
      );
    return NextResponse.json(result, { headers });
  } catch {
    console.error("[entry-upload] request failed");
    return NextResponse.json(
      { error: "画像を保存できませんでした。時間をおいて再度お試しください" },
      { status: 503, headers },
    );
  }
}
