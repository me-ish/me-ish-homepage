import { buildOrderMailLogEntry } from "@/features/natori/lib/orderMail";

export function buildStructuredQuoteMailLogMarker(quoteId: string): string {
  return `[structured-quote:${quoteId}]`;
}

export function appendStructuredQuoteMailLog(input: {
  currentNote: string | null;
  quoteId: string;
  sentAt: string;
  toEmail: string;
  amount: number;
}): string {
  const marker = buildStructuredQuoteMailLogMarker(input.quoteId);
  const currentNote = input.currentNote ?? "";
  if (currentNote.includes(marker)) return currentNote;

  const entry = `${marker}\n${buildOrderMailLogEntry(
    "estimate",
    input.sentAt,
    input.toEmail,
    input.amount,
  )}`;
  return currentNote ? `${currentNote}\n\n${entry}` : entry;
}
