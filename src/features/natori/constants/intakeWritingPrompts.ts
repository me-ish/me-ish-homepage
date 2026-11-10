// features/natori/constants/intakeWritingPrompts.ts
// 依頼フォームの本文欄の上に並べる「書き出しボタン」の文面。
// 押すと本文の末尾に見出し行（例「誰を：」）が 1 行入る。

export type IntakeWritingPrompt = {
  /** ボタンに出す文字（先頭の「＋」は表示側で付ける） */
  label: string;
  /** 本文に差し込む見出し行 */
  heading: string;
};

export const NATORI_INTAKE_WRITING_PROMPTS: readonly IntakeWritingPrompt[] = [
  { label: "誰を", heading: "誰を：" },
  { label: "表情・ポーズ", heading: "表情・ポーズ：" },
  { label: "服・小物", heading: "服・小物：" },
  { label: "雰囲気", heading: "雰囲気：" },
] as const;
