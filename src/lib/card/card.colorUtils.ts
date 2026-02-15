// src/lib/card/card.colorUtils.ts
// Shared color manipulation helpers for card design

/**
 * Parse hex color to RGB tuple
 */
function parseHex(c: string): [number, number, number] {
  const h = c.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Convert RGB tuple to hex string
 */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

/**
 * Blend two hex colors by ratio (0 = c1, 1 = c2)
 */
export function blendColor(c1: string, c2: string, ratio: number): string {
  try {
    const [r1, g1, b1] = parseHex(c1);
    const [r2, g2, b2] = parseHex(c2);
    return toHex(
      r1 + (r2 - r1) * ratio,
      g1 + (g2 - g1) * ratio,
      b1 + (b2 - b1) * ratio,
    );
  } catch {
    return c1;
  }
}

/**
 * Increase color saturation by factor (0-1)
 */
export function saturateColor(hex: string, factor: number): string {
  try {
    const [r, g, b] = parseHex(hex);
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    return toHex(
      gray + (r - gray) * (1 + factor),
      gray + (g - gray) * (1 + factor),
      gray + (b - gray) * (1 + factor),
    );
  } catch {
    return hex;
  }
}

/**
 * Decrease color saturation by factor (0-1)
 */
export function desaturateColor(hex: string, factor: number): string {
  try {
    const [r, g, b] = parseHex(hex);
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    return toHex(
      r + (gray - r) * factor,
      g + (gray - g) * factor,
      b + (gray - b) * factor,
    );
  } catch {
    return hex;
  }
}
