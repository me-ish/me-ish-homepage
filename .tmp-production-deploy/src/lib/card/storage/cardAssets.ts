// src/lib/card/storage/cardAssets.ts
// Client-safe: only proxy URL generation

export function cardAssetProxyUrl(path: string) {
  const p = String(path ?? "")
    .trim()
    .replace(/^\/+/, "");

  return `/api/card/assets?path=${encodeURIComponent(p)}`;
}
