// Explicit old-case contract: retirement requires a separately reviewed change.
// No conditional suite flags, missing-module fallback, or successful skip.
// 2026-10-10: the 21 upload/publication cases were retired with the product.
// The current contract is a side-effect-free pause; Natori cases stay unchanged.
export const galleryCases = ["retired-upload-stops-before-effects"];
export const legacyAssetCases = [
  "remaining-bucket/aura-assets",
  "remaining-bucket/card-assets",
];
export const natoriCases = [
  "remaining-bucket/natori-portfolio",
  "signed-tus-client-large-file",
  "signed-tus-client-resume",
];

/** @param {{ name: string, status: string }[]} results */
export function assertCaseInventory(results) {
  const expected = [...galleryCases, ...legacyAssetCases, ...natoriCases];
  if (results.length !== expected.length || results.some((result, index) =>
    result.name !== expected[index] || !["passed", "failed"].includes(result.status))) {
    throw new Error("PHASE_0A_CASE_INVENTORY_MISMATCH");
  }
}
