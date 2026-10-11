/** A short fingerprint of which messages are roughs and which have an OK, so a poll can tell when that changed. */
export function roughSignature(roughs: { id: string; answered: boolean }[]): string {
  return roughs.map(rough => `${rough.id}${rough.answered ? "+" : "-"}`).sort().join(",");
}
