import { describe, expect, it } from "vitest";
import {
  appendStructuredQuoteMailLog,
  buildStructuredQuoteMailLogMarker,
} from "@/features/natori/lib/structuredQuoteMailLog";

const QUOTE_ID = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";

describe("structured quote mail log", () => {
  it("adds a quote-specific marker and mail history", () => {
    const note = appendStructuredQuoteMailLog({
      currentNote: "既存メモ",
      quoteId: QUOTE_ID,
      sentAt: "2026-08-02",
      toEmail: "client@example.com",
      amount: 12000,
    });

    expect(note).toContain("既存メモ");
    expect(note).toContain(buildStructuredQuoteMailLogMarker(QUOTE_ID));
    expect(note).toContain("client@example.com");
    expect(note).toContain("12,000");
  });

  it("does not append the same quote history twice", () => {
    const first = appendStructuredQuoteMailLog({
      currentNote: null,
      quoteId: QUOTE_ID,
      sentAt: "2026-08-02",
      toEmail: "client@example.com",
      amount: 12000,
    });
    const second = appendStructuredQuoteMailLog({
      currentNote: first,
      quoteId: QUOTE_ID,
      sentAt: "2026-08-03",
      toEmail: "other@example.com",
      amount: 99999,
    });

    expect(second).toBe(first);
    expect(second.match(/\[structured-quote:/g)).toHaveLength(1);
  });

  it("allows a different quote version to add another history entry", () => {
    const first = appendStructuredQuoteMailLog({
      currentNote: null,
      quoteId: QUOTE_ID,
      sentAt: "2026-08-02",
      toEmail: "client@example.com",
      amount: 12000,
    });
    const second = appendStructuredQuoteMailLog({
      currentNote: first,
      quoteId: "ba24cb61-b3ff-4584-87f9-d549bc3af77d",
      sentAt: "2026-08-03",
      toEmail: "client@example.com",
      amount: 15000,
    });

    expect(second.match(/\[structured-quote:/g)).toHaveLength(2);
  });
});
