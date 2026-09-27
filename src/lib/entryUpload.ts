import { z } from "zod";

export const ENTRY_UPLOAD_BUCKET = "gallery-entry-intake";
export const ENTRY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const ENTRY_UPLOAD_LIFETIME_MS = 2 * 60 * 60 * 1000;

export const entryUploadInput = z
  .object({
    mimeType: z.enum(["image/jpeg", "image/png"]),
    sizeBytes: z.number().int().positive().max(ENTRY_IMAGE_MAX_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type EntryUploadInput = z.infer<typeof entryUploadInput>;

export const entryUploadRequest = z.discriminatedUnion("action", [
  entryUploadInput.extend({ action: z.literal("sign") }).strict(),
  z
    .object({
      action: z.literal("finish"),
      receipt: z.string().min(1).max(2048),
    })
    .strict(),
]);
