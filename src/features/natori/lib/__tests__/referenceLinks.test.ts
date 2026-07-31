import { describe, expect, it } from "vitest";
import { normalizeNatoriReferenceUrl } from "../referenceLinks";

describe("normalizeNatoriReferenceUrl", () => {
  it("lowercases scheme and host and removes the default HTTPS port and fragment", () => {
    expect(
      normalizeNatoriReferenceUrl(
        "HTTPS://EXAMPLE.COM:443/Asset.PNG?token=AbC#preview",
      ),
    ).toBe("https://example.com/Asset.PNG?token=AbC");
  });

  it("preserves path trailing slashes and query parameter order", () => {
    expect(normalizeNatoriReferenceUrl("https://example.com/a?b=2&a=1")).toBe(
      "https://example.com/a?b=2&a=1",
    );
    expect(normalizeNatoriReferenceUrl("https://example.com/a/?b=2&a=1")).toBe(
      "https://example.com/a/?b=2&a=1",
    );
  });

  it("uses WHATWG root-path serialization and preserves non-default ports", () => {
    expect(normalizeNatoriReferenceUrl("HTTPS://EXAMPLE.COM:443")).toBe(
      "https://example.com/",
    );
    expect(normalizeNatoriReferenceUrl("https://EXAMPLE.COM:80")).toBe(
      "https://example.com:80/",
    );
  });

  it("rejects non-HTTPS, invalid, blank, and oversized values", () => {
    expect(normalizeNatoriReferenceUrl("http://example.com/a")).toBeNull();
    expect(
      normalizeNatoriReferenceUrl("https://user:password@example.com/a"),
    ).toBeNull();
    expect(normalizeNatoriReferenceUrl("not a URL")).toBeNull();
    expect(normalizeNatoriReferenceUrl("   ")).toBeNull();
    expect(
      normalizeNatoriReferenceUrl(`https://example.com/${"a".repeat(2048)}`),
    ).toBeNull();
  });
});
