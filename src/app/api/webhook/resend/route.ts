import { NextResponse } from "next/server";
import { receiveCaseMailWebhook } from "@/features/natori/server/caseMailWebhook";
export const runtime = "nodejs",
  dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 65536)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  const reader = request.body?.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 65536) {
          await reader.cancel();
          return NextResponse.json({ error: "too_large" }, { status: 413 });
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const result = await receiveCaseMailWebhook(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      request.headers,
    );
    return NextResponse.json(result, {
      status:
        result.result === "conflict"
          ? 409
          : result.result === "unmatched"
            ? 503
            : 200,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status =
      code === "webhook_signature_invalid"
        ? 401
        : code === "webhook_scope_invalid" ||
            code === "webhook_tags_invalid" ||
            code === "webhook_payload_invalid" ||
            error instanceof SyntaxError
          ? 400
          : 503;
    return NextResponse.json({ error: "webhook_unconfirmed" }, { status });
  }
}
