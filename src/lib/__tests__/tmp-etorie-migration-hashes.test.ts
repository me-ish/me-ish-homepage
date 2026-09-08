import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "supabase/migrations/20260908111337_etorie_quote_optional_message.sql",
  "supabase/migrations/20260908124222_etorie_publication_allowed_from_validator_fix.sql",
];

describe("temporary Etorie migration hash output", () => {
  it("prints exact SHA-256 values for manifest maintenance", () => {
    for (const file of files) {
      const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
      console.log(`ETORIE_MIGRATION_SHA256 ${file} ${hash}`);
      expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    }
  });
});
