import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    "src",
    "features",
    "natori",
    "server",
    "structuredQuoteService.ts",
  ),
  "utf8",
);

describe("structuredQuoteService mail delivery safety", () => {
  it("uses a stable Resend idempotency key derived from the issued quote", () => {
    expect(source).toMatch(
      /resend\.emails\.send\([\s\S]*?idempotencyKey:\s*`natori-structured-quote\/\$\{issued\.quoteId\}`/u,
    );
  });

  it("does not derive mail idempotency from a transient token or timestamp", () => {
    const optionBlock = source.match(
      /idempotencyKey:\s*`natori-structured-quote\/\$\{issued\.quoteId\}`/u,
    )?.[0];
    expect(optionBlock).toBeTruthy();
    expect(optionBlock).not.toContain("acceptToken");
    expect(optionBlock).not.toContain("Date.now");
  });
});
