const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ASSET_URL = new RegExp(`^/api/natori/(admin/portfolio-assets|portfolio/assets)/(${UUID})\\.(webp|mp4)$`,"i");
export const NATORI_MANAGEMENT_ASSET_BUCKET = "natori-management-assets";
export function parsePortfolioAssetUrl(value:string) {
  let path:string;
  try {path=decodeURIComponent(new URL(value,"https://portfolio.invalid").pathname);} catch {return null;}
  const match=ASSET_URL.exec(path);
  return match ? {id:match[2].toLowerCase(),management:match[1].toLowerCase()==="admin/portfolio-assets",kind:match[3].toLowerCase()==="webp" ? "image" as const : "video" as const} : null;
}
export function portfolioAssetUrl(id:string,kind:"image"|"video",management:boolean):string {
  return `/api/natori/${management ? "admin/portfolio-assets" : "portfolio/assets"}/${id}.${kind==="image" ? "webp" : "mp4"}`;
}
export function publicPortfolioImageUrl(value:string|null):string|null {
  if (!value) return null;
  const asset=parsePortfolioAssetUrl(value);
  if (asset) return portfolioAssetUrl(asset.id,asset.kind,false);
  try {
    const path=decodeURIComponent(new URL(value,"https://portfolio.invalid").pathname);
    if (path.startsWith("/api/natori/admin/") || /\/storage\/v1\/object\/(?:sign|authenticated)\//.test(path)) return null;
  } catch { return null; }
  return value;
}
/** Canonical identity also closes query-string aliases of a hidden image. */
export function portfolioImageIdentity(value:string):string {
  const managed=parsePortfolioAssetUrl(value);
  if (managed) return managed.id;
  try {
    const url=new URL(value,"https://portfolio.invalid");
    return `${url.origin}${decodeURIComponent(url.pathname)}`;
  } catch { return value; }
}
