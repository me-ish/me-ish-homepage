import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DeliveryManifestFile } from "../types/delivery";

export const DELIVERY_BUCKET = "natori-deliveries";

/** Credentials and signed URLs stay on the server. A successful signature alone is not evidence. */
export async function verifyDeliveryObject(file: {
  id: string; path: string; fileName: string; sizeBytes: number;
  contentType?: string | null; storageVersion?: string | null;
}, downloadSeconds = 60): Promise<(DeliveryManifestFile & { url: string }) | null> {
  try {
    const storage = supabaseAdmin().storage.from(DELIVERY_BUCKET);
    const slash = file.path.lastIndexOf("/");
    const name = file.path.slice(slash + 1);
    const listed = await storage.list(file.path.slice(0, slash), { search: name, limit: 100 });
    const object = listed.data?.find(item => item.name === name);
    const metadata = object?.metadata as { size?: unknown; mimetype?: unknown; eTag?: unknown } | undefined;
    if (listed.error || !object?.id || !object.updated_at || Number(metadata?.size) !== file.sizeBytes
      || typeof metadata?.mimetype !== "string" || !metadata.mimetype
      || (file.contentType && file.contentType !== metadata.mimetype)) return null;
    const version = `${object.id}/${object.updated_at}/${String(metadata.eTag ?? "")}`;
    if (file.storageVersion && version !== file.storageVersion) return null;
    const signed = await storage.createSignedUrl(file.path, downloadSeconds, { download: file.fileName });
    if (signed.error || !signed.data) return null;
    const url = new URL(signed.data.signedUrl);
    const expected = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.origin !== expected.origin || !url.pathname.startsWith(`/storage/v1/object/sign/${DELIVERY_BUCKET}/`)) return null;
    const response = await fetch(url, {
      method: "GET", headers: { Range: "bytes=0-0" }, redirect: "error",
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const total = response.status === 206
      ? Number(response.headers.get("content-range")?.match(/^bytes 0-0\/(\d+)$/)?.[1])
      : Number(response.headers.get("content-length"));
    if (![200, 206].includes(response.status) || total !== file.sizeBytes || !response.body) {
      await response.body?.cancel(); return null;
    }
    const reader = response.body.getReader();
    const prefix = await reader.read();
    await reader.cancel();
    if (prefix.done || !prefix.value?.length) return null;
    return { id: file.id, path: file.path, fileName: file.fileName, sizeBytes: file.sizeBytes,
      contentType: metadata.mimetype, storageVersion: version, url: signed.data.signedUrl };
  } catch {
    // Do not log network errors containing capability URLs, paths or credentials.
    return null;
  }
}
