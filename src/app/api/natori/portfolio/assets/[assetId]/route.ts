import { readPortfolioAsset } from "@/features/natori/server/portfolioAssetsService";
import { parsePortfolioAssetFileName } from "@/features/natori/lib/portfolioAssetUrl";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params,
    asset = parsePortfolioAssetFileName(assetId);
  if (!asset) return new Response(null, { status: 404, headers });
  try {
    const image = await readPortfolioAsset(
      request,
      asset.id,
      asset.kind,
      false,
    );
    return image ?? new Response(null, { status: 404, headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
