// imageSniff のテスト。マジックナンバー（実バイト）判定の境界を固定する。
// 公開アップロード経路は MIME 申告を信用せず、この判定を必ず通る。
import { describe, expect, it } from "vitest";
import { sniffImageFormat } from "@/lib/imageSniff";

function bytes(...values: (number | string)[]): Uint8Array {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === "string") {
      for (const ch of v) out.push(ch.charCodeAt(0));
    } else {
      out.push(v);
    }
  }
  return new Uint8Array(out);
}

describe("sniffImageFormat", () => {
  it("PNG シグネチャを判定する", () => {
    expect(
      sniffImageFormat(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00))
    ).toBe("png");
  });

  it("JPEG シグネチャを判定する", () => {
    expect(sniffImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("jpeg");
  });

  it("GIF87a / GIF89a を判定し、それ以外の GIF ヘッダは弾く", () => {
    expect(sniffImageFormat(bytes("GIF87a", 0x00))).toBe("gif");
    expect(sniffImageFormat(bytes("GIF89a", 0x00))).toBe("gif");
    expect(sniffImageFormat(bytes("GIF88a", 0x00))).toBeNull();
  });

  it("WebP (RIFF....WEBP) を判定し、RIFF でも WEBP でないものは弾く", () => {
    expect(sniffImageFormat(bytes("RIFF", 0x10, 0x00, 0x00, 0x00, "WEBP"))).toBe("webp");
    expect(sniffImageFormat(bytes("RIFF", 0x10, 0x00, 0x00, 0x00, "WAVE"))).toBeNull();
  });

  it("SVG（テキスト/XML）はマジックナンバーを持たないので null", () => {
    expect(
      sniffImageFormat(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))
    ).toBeNull();
    expect(sniffImageFormat(bytes('<?xml version="1.0"?><svg>'))).toBeNull();
  });

  it("空・短すぎるバッファは null", () => {
    expect(sniffImageFormat(new Uint8Array(0))).toBeNull();
    expect(sniffImageFormat(bytes(0x89, "PN"))).toBeNull();
    expect(sniffImageFormat(bytes("RIFF", 0x10, 0x00))).toBeNull();
  });
});
