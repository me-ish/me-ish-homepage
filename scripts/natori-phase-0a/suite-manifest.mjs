// Explicit old-case contract: retirement requires a separately reviewed change.
// No conditional suite flags, missing-module fallback, or successful skip.
export const galleryCases = [
  "origin-and-csrf",
  "invalid-sign-path",
  "invalid-sign-bucket",
  "invalid-sign-mime",
  "invalid-sign-size",
  "invalid-sign-hash",
  "rate-limit",
  "receipt-tamper-and-expiry",
  "finish-before-upload",
  "staging-private-and-unsigned-write-denied",
  "signed-scope-cannot-change-path",
  "storage-enforces-size-and-mime",
  "fake-image",
  "small-image",
  "truncated-image",
  "receipt-binds-bytes",
  "publish-png-and-replay",
  "publish-jpeg-and-replay",
  "concurrent-finish",
  "concurrent-observed-natural",
  "concurrent-observed-synchronized",
];
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
