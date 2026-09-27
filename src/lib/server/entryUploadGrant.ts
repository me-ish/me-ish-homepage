import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { entryUploadInput, ENTRY_UPLOAD_LIFETIME_MS, type EntryUploadInput } from "@/lib/entryUpload";

const grantSchema = entryUploadInput.extend({
  version: z.literal(1),
  fileName: z.string().regex(/^entry_[0-9a-f-]{36}\.(png|jpg)$/),
  expiresAt: z.number().int().positive(),
}).strict();
export type EntryUploadGrant = z.infer<typeof grantSchema>;

function signature(payload: string, key: string): Buffer {
  if (key.length < 32) throw new Error("ENTRY_UPLOAD_SIGNING_KEY_MISSING");
  // Domain separation: this receipt is not a Supabase JWT or an auth session.
  return createHmac("sha256", key).update(`me-ish/gallery-entry/v1\0${payload}`).digest();
}

export function issueEntryUploadGrant(input: EntryUploadInput, key: string, now = Date.now()) {
  const checked = entryUploadInput.parse(input);
  const grant: EntryUploadGrant = {
    ...checked, version: 1,
    fileName: `entry_${randomUUID()}.${checked.mimeType === "image/png" ? "png" : "jpg"}`,
    expiresAt: now + ENTRY_UPLOAD_LIFETIME_MS,
  };
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return { grant, receipt: `${payload}.${signature(payload, key).toString("base64url")}` };
}

export function verifyEntryUploadGrant(receipt: string, key: string, now = Date.now()): EntryUploadGrant | null {
  if (receipt.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(receipt)) return null;
  const [payload, supplied] = receipt.split(".");
  const actual = Buffer.from(supplied, "base64url");
  const expected = signature(payload, key);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = grantSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.expiresAt <= now || parsed.data.expiresAt > now + ENTRY_UPLOAD_LIFETIME_MS) return null;
    return parsed.data;
  } catch { return null; }
}
