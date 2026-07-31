export const NATORI_REFERENCE_LINK_MAX_LENGTH = 2048;

/**
 * Produces the stable duplicate-detection form for an external project link.
 * WHATWG URL serialization intentionally preserves path, trailing-slash, and
 * query ordering while normalizing the scheme/host and HTTPS default port.
 */
export function normalizeNatoriReferenceUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.length > NATORI_REFERENCE_LINK_MAX_LENGTH) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    parsed.hash = "";
    const normalized = parsed.toString();
    return normalized.length <= NATORI_REFERENCE_LINK_MAX_LENGTH
      ? normalized
      : null;
  } catch {
    return null;
  }
}
