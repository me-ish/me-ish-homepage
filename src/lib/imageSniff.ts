// 画像フォーマットのマジックナンバー（実バイト）判定。
// Content-Type / File.type はクライアント申告値であり偽装できるため、
// 公開アップロード経路では必ずこちらで実バイトを確認する。
// SVG はテキスト（XML）でありマジックナンバーを持たないため常に null になる
// （= 公開経路では受け付けない。スクリプト混入・SSRF の温床になるため）。

export type SniffedImageFormat = "png" | "jpeg" | "webp" | "gif";

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[offset + i] !== prefix[i]) return false;
  }
  return true;
}

/**
 * 先頭バイトから画像フォーマットを判定する。判定できなければ null。
 * 対応: PNG / JPEG / WebP / GIF（87a・89a）
 */
export function sniffImageFormat(bytes: Uint8Array): SniffedImageFormat | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }
  // GIF: "GIF87a" or "GIF89a"
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "gif";
  }
  // WebP: "RIFF" .... "WEBP"（4〜7 バイト目はファイルサイズ）
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  return null;
}
