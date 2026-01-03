// src/lib/aiPortfolio/storage/auraAssets.ts
// クライアントから import されても安全な util のみ置く

export function auraAssetProxyUrl(path: string) {
  const p = String(path ?? "")
    .trim()
    .replace(/^\/+/, ""); // 先頭の / は落とす

  return `/api/aiPortfolio/assets?path=${encodeURIComponent(p)}`;
}
