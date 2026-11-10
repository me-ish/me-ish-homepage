// features/natori/lib/intakeWritingPrompts.ts
// 書き出しボタンで本文に見出し行を足す純関数。
// 同じ見出しで始まる行がすでにあれば足さず、その行の末尾にカーソルを置く。

export type WritingPromptInsertion = {
  message: string;
  /** 挿入後にカーソルを置く位置（文字数） */
  caret: number;
};

export function insertWritingPrompt(
  message: string,
  heading: string,
  maxLength = 2000,
): WritingPromptInsertion {
  const lines = message.split("\n");
  let offset = 0;
  for (const line of lines) {
    if (line.startsWith(heading)) return { message, caret: offset + line.length };
    offset += line.length + 1;
  }
  const separator = message.length === 0 || message.endsWith("\n") ? "" : "\n";
  const next = `${message}${separator}${heading}`;
  if (next.length > maxLength) return { message, caret: message.length };
  return { message: next, caret: next.length };
}
