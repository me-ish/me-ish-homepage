// src/lib/card/card.tierGate.ts
// All features are currently free (no tier restrictions)

export const TIER_LIMITS = {
  free: {
    maxWorks: 5,
    animation: true,
    pdfExport: true,
    customSlug: true,
    branding: false,
  },
  premium: {
    maxWorks: 5,
    animation: true,
    pdfExport: true,
    customSlug: true,
    branding: false,
  },
} as const;

export type TierKey = keyof typeof TIER_LIMITS;

export function getTierLimits(tier: string) {
  if (tier === "premium") return TIER_LIMITS.premium;
  return TIER_LIMITS.free;
}

/**
 * Check if a feature is available for the given tier
 */
export function isTierFeature(
  tier: string,
  feature: keyof (typeof TIER_LIMITS)["free"],
): boolean {
  const limits = getTierLimits(tier);
  return Boolean(limits[feature]);
}
