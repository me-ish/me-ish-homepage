import type { DeliveryManifestFile } from "../types/delivery";

export const DELIVERY_MAX_FILES = 10;
export const DELIVERY_MAX_BYTES = 200 * 1024 * 1024;
export const DELIVERY_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const DELIVERY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** An issued manifest is read as a complete set; an invalid member is never omitted. */
export function readDeliveryManifest(value: unknown): DeliveryManifestFile[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > DELIVERY_MAX_FILES) return null;
  const files: DeliveryManifestFile[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || !DELIVERY_UUID_RE.test(item.id)
      || typeof item.path !== "string" || typeof item.fileName !== "string"
      || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 1 || item.sizeBytes > DELIVERY_MAX_BYTES
      || typeof item.contentType !== "string" || !item.contentType
      || typeof item.storageVersion !== "string" || !item.storageVersion) return null;
    files.push(item as DeliveryManifestFile);
  }
  return new Set(files.map(file => file.id)).size === files.length ? files : null;
}
