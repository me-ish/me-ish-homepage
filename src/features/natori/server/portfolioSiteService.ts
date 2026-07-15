import "server-only";

// features/natori/server/portfolioSiteService.ts
// /natori/portfolio の掲載内容の読み込み・保存と画像アップロード。
// 書き込みは service role 経由のみ（テーブルに書き込みRLSポリシーは無い）。
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canUseNatoriManagement } from "./requireNatoriAdmin";
import { parsePortfolioContent } from "@/features/natori/lib/portfolioContent";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const TABLE = "natori_portfolio_content";
const BUCKET = "natori-portfolio";
const ROW_ID = "main";

function adminClient() {
  return supabaseAdmin();
}

const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** 編集画面・編集APIのアクセス可否（requireNatoriAccess と同じ判定） */
export async function canEditNatoriPortfolio(): Promise<boolean> {
  return canUseNatoriManagement();
}

/** 掲載内容を読み込む。DB行が無い/壊れている/テーブル未作成ならデフォルトを返す */
export async function loadPortfolioContent(): Promise<PortfolioContent> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from(TABLE)
      .select("content")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) {
      console.error("[natori-portfolio] content load failed:", error);
      return defaultPortfolioContent;
    }
    if (!data) return defaultPortfolioContent;
    return parsePortfolioContent(data.content) ?? defaultPortfolioContent;
  } catch (err) {
    console.error("[natori-portfolio] content load threw:", err);
    return defaultPortfolioContent;
  }
}

export type SavePortfolioContentResult =
  | { kind: "ok"; content: PortfolioContent }
  | { kind: "invalid" }
  | { kind: "db-error" };

export async function savePortfolioContent(
  value: unknown
): Promise<SavePortfolioContentResult> {
  const content = parsePortfolioContent(value);
  if (!content) return { kind: "invalid" };

  const admin = adminClient();
  const { error } = await admin
    .from(TABLE)
    .upsert({ id: ROW_ID, content }, { onConflict: "id" });
  if (error) {
    console.error("[natori-portfolio] content save failed:", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", content };
}

export type UploadPortfolioImageResult =
  | { kind: "ok"; url: string }
  | { kind: "invalid-type" }
  | { kind: "too-large" }
  | { kind: "upload-error" };

/** 画像を webp に変換して公開バケットの指定フォルダへアップロードし、公開URLを返す */
async function uploadImageAsWebp(
  file: File,
  folder: string
): Promise<UploadPortfolioImageResult> {
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) return { kind: "invalid-type" };
  if (file.size > IMAGE_MAX_BYTES) return { kind: "too-large" };

  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input)
    .rotate() // EXIF回転を反映
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();

  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) {
    console.error("[natori-portfolio] image upload failed:", error);
    return { kind: "upload-error" };
  }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { kind: "ok", url: data.publicUrl };
}

/** 編集画面からの掲載用画像アップロード */
export async function uploadPortfolioImage(
  file: File
): Promise<UploadPortfolioImageResult> {
  return uploadImageAsWebp(file, "images");
}

/** ご依頼フォーム（公開）からのキャラクター資料アップロード。refs/ 配下に分けて保存する */
export async function uploadPortfolioReferenceImage(
  file: File
): Promise<UploadPortfolioImageResult> {
  return uploadImageAsWebp(file, "refs");
}
