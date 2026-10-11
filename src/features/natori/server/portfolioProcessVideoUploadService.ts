import "server-only";

// features/natori/server/portfolioProcessVideoUploadService.ts
// 制作過程の動画ファイルのアップロード準備。
// 動画は大きく Vercel のボディ制限を通せないので、ここでは署名付きアップロードURLだけを発行し、
// 実際のアップロードはブラウザから Storage へ直接行う（納品ファイルと同じ方式）。
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PROCESS_VIDEO_BUCKET,
  PROCESS_VIDEO_FILE_EXTENSION,
  PROCESS_VIDEO_FOLDER,
} from "@/features/natori/constants/portfolioProcessVideo";
import { checkProcessVideoFile } from "@/features/natori/lib/portfolioProcessVideo";

export type PrepareProcessVideoUploadResult =
  | { kind: "ok"; path: string; token: string; publicUrl: string }
  | { kind: "invalid-type" }
  | { kind: "empty" }
  | { kind: "too-large" }
  | { kind: "storage-error" };

/**
 * 動画ファイルを置く場所（推測できないファイル名）を決め、その場所にだけ書き込める署名付きアップロードを発行する。
 * 同じ名前では上書きできないので、動画を差し替えると別のファイルになる（古いファイルは自動では消さない）。
 */
export async function prepareProcessVideoUpload(input: {
  sizeBytes: number;
  contentType: string;
}): Promise<PrepareProcessVideoUploadResult> {
  const problem = checkProcessVideoFile({ type: input.contentType, size: input.sizeBytes });
  if (problem === "not-mp4") return { kind: "invalid-type" };
  if (problem === "empty") return { kind: "empty" };
  if (problem === "too-large") return { kind: "too-large" };

  const path = `${PROCESS_VIDEO_FOLDER}/${crypto.randomUUID()}${PROCESS_VIDEO_FILE_EXTENSION}`;
  const bucket = supabaseAdmin().storage.from(PROCESS_VIDEO_BUCKET);
  const signed = await bucket.createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data) {
    console.error("[natori-portfolio] process video signed upload failed:", signed.error);
    return { kind: "storage-error" };
  }
  const { data } = bucket.getPublicUrl(path);
  return { kind: "ok", path, token: signed.data.token, publicUrl: data.publicUrl };
}
