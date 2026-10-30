/** One short line from a talk message for the トーク list; an empty body means only files were sent. */
export function caseTalkExcerpt(body: string, attachments: number | null | undefined, max = 40): string {
  const line = body.split(/\r?\n/).map(part => part.trim()).find(Boolean) ?? "";
  if (!line) return attachments ? "（ファイルを送りました）" : "";
  const chars = [...line];
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : line;
}
