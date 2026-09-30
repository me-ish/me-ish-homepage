import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Json } from "@/types/supabase";

const FORMAT = "natori-delivery-aes256gcm-v1";
function encryptionKey(): Buffer {
  const value = process.env.NATORI_DELIVERY_NOTIFICATION_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("delivery_mail_configuration");
  return Buffer.from(value, "hex");
}

/** Snapshot is encrypted before the publication transaction; plaintext tokens never enter DB evidence. */
export function sealDeliveryNotification(payload: unknown, expiresAt: string): Json {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${FORMAT}/${expiresAt}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return { format: FORMAT, expiresAt, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64") };
}

export function openDeliveryNotification(value: Json): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.format !== FORMAT
    || typeof value.expiresAt !== "string" || typeof value.iv !== "string"
    || typeof value.tag !== "string" || typeof value.ciphertext !== "string"
    || Date.parse(value.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(value.expiresAt))) {
    throw new Error("delivery_mail_configuration");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAAD(Buffer.from(`${FORMAT}/${value.expiresAt}`));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const decoded = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(decoded.toString("utf8"));
}
