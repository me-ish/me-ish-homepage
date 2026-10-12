import "server-only";

// features/natori/server/portfolioProcessVideoUploadService.ts
// 制作過程の動画ファイルのアップロード準備。
// 動画は大きく Vercel のボディ制限を通せないので、ここでは署名付きアップロードURLだけを発行し、
// 実際のアップロードはブラウザから Storage へ直接行う（納品ファイルと同じ方式）。
import {preparePrivatePortfolioVideo} from "./portfolioAssetsService";
import { checkProcessVideoFile } from "@/features/natori/lib/portfolioProcessVideo";

export type PrepareProcessVideoUploadResult =
  | { kind: "ok"; assetId:string; path: string; token: string; url: string }
  | { kind: "invalid-type" }
  | { kind: "empty" }
  | { kind: "too-large" }
  | { kind: "storage-error" };

/**
 * 動画ファイルを置く場所（推測できないファイル名）を決め、その場所にだけ書き込める署名付きアップロードを発行する。
 * 署名はprivate stagingだけを許可する。検証時にserverが別の署名されないpathへcopyし、
 * 検証済みsnapshotだけを公開可能にする（古いファイルは自動では消さない）。
 */
export async function prepareProcessVideoUpload(input: {
  sizeBytes: number;
  contentType: string;
}): Promise<PrepareProcessVideoUploadResult> {
  const problem = checkProcessVideoFile({ type: input.contentType, size: input.sizeBytes });
  if (problem === "not-mp4") return { kind: "invalid-type" };
  if (problem === "empty") return { kind: "empty" };
  if (problem === "too-large") return { kind: "too-large" };

  const prepared=await preparePrivatePortfolioVideo(input.sizeBytes);
  if (!prepared) {
    console.error("[natori-portfolio] process video signed upload unavailable");
    return { kind: "storage-error" };
  }
  return {kind:"ok",assetId:prepared.id,path:prepared.path,token:prepared.token,url:prepared.url};
}
