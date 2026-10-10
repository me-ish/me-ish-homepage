// features/natori/data/supabaseProcessVideo.ts
// 制作過程の動画ファイルのブラウザ側アップロード。
// 署名付きアップロードURLを編集用 API で発行し、ブラウザから Supabase Storage へ直接上げる
// （動画は大きく、Vercel のボディ制限を通せないため。納品ファイルと同じ方式）。
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { createClient } from "@/lib/supabase/client";
import {
  PROCESS_VIDEO_BUCKET,
  PROCESS_VIDEO_FILE_CONTENT_TYPE,
} from "../constants/portfolioProcessVideo";
import { consultationUploadEndpoint } from "../lib/consultationUploadEndpoint";
import {
  checkProcessVideoFile,
  describeProcessVideoFileProblem,
  parseProcessVideoFileUrl,
} from "../lib/portfolioProcessVideo";

/** これより大きいファイルは、途切れても続きから送れる再開可能アップロード（TUS）で送る */
const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024;
/** ファイル名は毎回新しいので、ブラウザには長く覚えておいてもらってよい（1年） */
const CACHE_CONTROL_SECONDS = "31536000";

/** 画面にそのまま出せる日本語の理由を持つエラー */
export class ProcessVideoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessVideoUploadError";
  }
}

const PREPARE_FAILED = "アップロードの準備ができませんでした。時間をおいて、もう一度お試しください。";
const UPLOAD_FAILED = "アップロードに失敗しました。通信状況を確認して、もう一度お試しください。";

type PrepareResponse = {
  ok?: boolean;
  path?: string;
  token?: string;
  publicUrl?: string;
  error?: string;
} | null;

function prepareErrorMessage(status: number, error: string | undefined, file: File): string {
  if (status === 401) return "ログインの有効期限が切れた可能性があります。ページを読み込み直して、もう一度お試しください。";
  if (error === "invalid_mime") return describeProcessVideoFileProblem("not-mp4");
  if (error === "file_empty") return describeProcessVideoFileProblem("empty");
  if (error === "file_too_large") return describeProcessVideoFileProblem("too-large", file.size);
  return PREPARE_FAILED;
}

/** 署名付きURLでの通常のアップロード（1回で送る）。小さいファイルと、再開可能アップロードが使えないときの予備 */
async function uploadWithSignedUrl(path: string, token: string, file: File): Promise<void> {
  const { error } = await createClient()
    .storage.from(PROCESS_VIDEO_BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: PROCESS_VIDEO_FILE_CONTENT_TYPE,
      cacheControl: CACHE_CONTROL_SECONDS,
    });
  if (error) throw new ProcessVideoUploadError(UPLOAD_FAILED);
}

/** 再開可能アップロード（TUS）。途切れたら自動でやり直し、進み具合を知らせる */
async function uploadWithResumable(
  path: string,
  token: string,
  file: File,
  onProgress: ((ratio: number) => void) | undefined
): Promise<void> {
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: consultationUploadEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      headers: { "x-signature": token },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: PROCESS_VIDEO_BUCKET,
        objectName: path,
        contentType: PROCESS_VIDEO_FILE_CONTENT_TYPE,
        cacheControl: CACHE_CONTROL_SECONDS,
      },
      onProgress: (sent, total) => onProgress?.(total > 0 ? sent / total : 0),
      onError: () => reject(new ProcessVideoUploadError(UPLOAD_FAILED)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

/**
 * 動画ファイルをアップロードして、公開ページで使うURLを返す。
 * 失敗したときは ProcessVideoUploadError（画面に出せる日本語の理由つき）を投げる。
 */
export async function uploadProcessVideoFile(
  file: File,
  options: { onProgress?: (ratio: number) => void } = {}
): Promise<string> {
  const problem = checkProcessVideoFile(file);
  if (problem) throw new ProcessVideoUploadError(describeProcessVideoFileProblem(problem, file.size));

  // 1) 署名付きアップロードURLの発行（置き場所の決定もここで行われる）
  const response = await fetch("/api/natori/portfolio/video-upload", {
    method: "POST",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ sizeBytes: file.size, contentType: PROCESS_VIDEO_FILE_CONTENT_TYPE }),
  }).catch(() => null);
  if (!response) throw new ProcessVideoUploadError(PREPARE_FAILED);
  const prepared = (await response.json().catch(() => null)) as PrepareResponse;
  if (!response.ok || !prepared?.ok || !prepared.path || !prepared.token || !prepared.publicUrl) {
    throw new ProcessVideoUploadError(prepareErrorMessage(response.status, prepared?.error, file));
  }
  // 保存できない形のURLなら、時間のかかるアップロードの前に止める
  const publicUrl = parseProcessVideoFileUrl(prepared.publicUrl);
  if (!publicUrl) throw new ProcessVideoUploadError(PREPARE_FAILED);

  // 2) ブラウザから Storage へ直接アップロード
  options.onProgress?.(0);
  if (file.size > RESUMABLE_THRESHOLD_BYTES) {
    try {
      await uploadWithResumable(prepared.path, prepared.token, file, options.onProgress);
    } catch {
      // 再開可能アップロードの口が使えないときも動画を載せられるよう、通常のアップロードでもう一度試す
      options.onProgress?.(0);
      await uploadWithSignedUrl(prepared.path, prepared.token, file);
    }
  } else {
    await uploadWithSignedUrl(prepared.path, prepared.token, file);
  }
  options.onProgress?.(1);
  return publicUrl;
}
