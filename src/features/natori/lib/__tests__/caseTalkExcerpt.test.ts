import { describe, expect, it } from "vitest";
import { caseTalkExcerpt } from "../caseTalkExcerpt";

describe("caseTalkExcerpt", () => {
  it("keeps only the first non-empty line and shortens it", () => {
    expect(caseTalkExcerpt("\n  ラフ見ました！  \n髪色だけ変えてほしいです", 0)).toBe("ラフ見ました！");
    expect(caseTalkExcerpt("あ".repeat(45), 0)).toBe(`${"あ".repeat(40)}…`);
  });
  it("says a file was sent when the body is empty", () => {
    expect(caseTalkExcerpt("", 2)).toBe("（ファイルを送りました）");
    expect(caseTalkExcerpt("  ", 0)).toBe("");
  });
});
