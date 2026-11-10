import { describe, expect, it } from "vitest";
import { insertWritingPrompt } from "../intakeWritingPrompts";

describe("insertWritingPrompt", () => {
  it("空の本文には見出しだけを入れる", () => {
    expect(insertWritingPrompt("", "誰を：")).toEqual({ message: "誰を：", caret: 3 });
  });

  it("書きかけの本文には改行してから足す", () => {
    const result = insertWritingPrompt("オリジナルキャラです", "表情・ポーズ：");
    expect(result.message).toBe("オリジナルキャラです\n表情・ポーズ：");
    expect(result.caret).toBe(result.message.length);
  });

  it("末尾が改行なら改行を重ねない", () => {
    expect(insertWritingPrompt("誰を：自分\n", "雰囲気：").message).toBe("誰を：自分\n雰囲気：");
  });

  it("同じ見出しがあれば足さずにその行末へカーソルを移す", () => {
    const message = "誰を：自分のオリジナルキャラ\n雰囲気：明るく";
    expect(insertWritingPrompt(message, "誰を：")).toEqual({ message, caret: "誰を：自分のオリジナルキャラ".length });
  });

  it("文字数の上限を超えるときは何も足さない", () => {
    const message = "あ".repeat(1999);
    expect(insertWritingPrompt(message, "誰を：")).toEqual({ message, caret: 1999 });
  });
});
