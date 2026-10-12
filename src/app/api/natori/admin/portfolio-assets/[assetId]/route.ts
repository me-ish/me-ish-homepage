import {withNatoriManagement} from "@/features/natori/server/natoriManagementRoute";
import {readPortfolioAsset} from "@/features/natori/server/portfolioAssetsService";
import {parsePortfolioAssetUrl} from "@/features/natori/lib/portfolioAssetUrl";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const fetchCache="force-no-store";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
export const GET=withNatoriManagement("portfolio-assets.GET",false,async (request:Request,{params}:{params:Promise<{assetId:string}>})=>{
  const {assetId}=await params,asset=parsePortfolioAssetUrl(`/api/natori/admin/portfolio-assets/${assetId}`);
  if (!asset) return new Response(null,{status:404,headers});
  try {
    const image=await readPortfolioAsset(request,asset.id,asset.kind,true);
    return image ?? new Response(null,{status:404,headers});
  } catch {return new Response(null,{status:503,headers});}
});
