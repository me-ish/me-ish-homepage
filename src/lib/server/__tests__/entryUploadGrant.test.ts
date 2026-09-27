import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  issueEntryUploadGrant,
  verifyEntryUploadGrant,
} from "../entryUploadGrant";
const key = "synthetic-test-only-signing-material-32-bytes";
const input = {
  mimeType: "image/png" as const,
  sizeBytes: 100,
  sha256: "a".repeat(64),
};
describe("gallery entry upload capability", () => {
  it("binds every publication field and uses a new path for each grant", () => {
    const one = issueEntryUploadGrant(input, key, 1000),
      two = issueEntryUploadGrant(input, key, 1000);
    expect(verifyEntryUploadGrant(one.receipt, key, 1001)).toEqual(one.grant);
    expect(one.grant.fileName).not.toEqual(two.grant.fileName);
    expect(one.grant.fileName).toMatch(/^entry_[0-9a-f-]+\.png$/);
  });
  it("rejects altered destinations, bytes, format and expiry", () => {
    const { receipt, grant } = issueEntryUploadGrant(input, key, 1000);
    const [, signature] = receipt.split(".");
    for (const patch of [
      { fileName: "../existing.png" },
      { sha256: "b".repeat(64) },
      { sizeBytes: 200 },
      { mimeType: "text/html" },
      { expiresAt: 9999999 },
    ]) {
      const payload = Buffer.from(
        JSON.stringify({ ...grant, ...patch }),
      ).toString("base64url");
      expect(
        verifyEntryUploadGrant(`${payload}.${signature}`, key, 1001),
      ).toBeNull();
    }
  });
  it("rejects another key, an expired receipt, malformed and oversized input", () => {
    const { receipt, grant } = issueEntryUploadGrant(input, key, 1000);
    expect(verifyEntryUploadGrant(receipt, key + "other", 1001)).toBeNull();
    expect(verifyEntryUploadGrant(receipt, key, grant.expiresAt)).toBeNull();
    for (const bad of ["", ".", "bad.signature", "a".repeat(2049)])
      expect(verifyEntryUploadGrant(bad, key, 1001)).toBeNull();
  });
  it("refuses invalid metadata and unavailable signing material", () => {
    expect(() =>
      issueEntryUploadGrant({ ...input, sizeBytes: 10485761 }, key),
    ).toThrow();
    expect(() => issueEntryUploadGrant(input, "")).toThrow(
      "ENTRY_UPLOAD_SIGNING_KEY_MISSING",
    );
  });
});
