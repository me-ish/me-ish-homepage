// src/lib/aiPortfolio/aiPortfolio.db.ts

import type { FormInput, Design, Content } from "./aiPortfolio.schema";

export type RequestStatus =
  | "draft"
  | "generated"
  | "paid"
  | "published"
  | "cancelled";

export type RequestRecord = {
  id: string;
  email: string;
  status: RequestStatus;
  slug?: string;
  prompt: FormInput;
  design?: Design;
  content?: Content;
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------------------------------------
 * グローバルストア（開発中・単一プロセス前提の簡易 DB）
 *   - ルートごとに別モジュールとして読み込まれても
 *     globalThis 経由で同じ Map を共有できるようにする
 * --------------------------------------------------------- */

declare global {
  // eslint-disable-next-line no-var
  var __aiPortfolioStore: Map<string, RequestRecord> | undefined;
  // eslint-disable-next-line no-var
  var __aiPortfolioSlugIndex: Map<string, string> | undefined;
}

// メモリ内ストア（プロトタイプ用）
const store: Map<string, RequestRecord> =
  globalThis.__aiPortfolioStore ?? new Map<string, RequestRecord>();

if (!globalThis.__aiPortfolioStore) {
  globalThis.__aiPortfolioStore = store;
}

// slug → id の逆引き（公開ページ用）
const slugIndex: Map<string, string> =
  globalThis.__aiPortfolioSlugIndex ?? new Map<string, string>();

if (!globalThis.__aiPortfolioSlugIndex) {
  globalThis.__aiPortfolioSlugIndex = slugIndex;
}

/* ---------------------------------------------------------
 * 補助関数
 * --------------------------------------------------------- */

function randomId(len = 16) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function slugifyBase(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function ensureUniqueSlug(base: string) {
  let slug = base || "portfolio";
  let i = 1;
  while (slugIndex.has(slug)) {
    slug = `${base || "portfolio"}-${i++}`;
  }
  return slug;
}

/* ---------------------------------------------------------
 * デバッグ用ログ
 * --------------------------------------------------------- */

function debugLog(prefix: string, rec?: RequestRecord) {
  if (!rec) {
    console.log(`[AI_DB] ${prefix}: <no record>`);
    return;
  }
  console.log(`[AI_DB] ${prefix}:`, {
    id: rec.id,
    status: rec.status,
    hasDesign: !!rec.design,
    hasContent: !!rec.content,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  });
}

/* ---------------------------------------------------------
 * API
 * --------------------------------------------------------- */

/**
 * フォーム送信直後（生成前）のレコード作成
 */
export function insertDraft(data: {
  email: string;
  prompt: FormInput;
}): RequestRecord {
  const id = randomId();
  const now = new Date().toISOString();

  const rec: RequestRecord = {
    id,
    email: data.email,
    status: "draft",
    prompt: data.prompt,
    createdAt: now,
    updatedAt: now,
  };

  store.set(id, rec);
  debugLog("insertDraft", rec);
  return rec;
}

/**
 * OpenAI で design / content が生成されたあとに更新
 */
export function updateGenerated(
  id: string,
  payload: { design: Design; content: Content }
): RequestRecord | undefined {
  const rec = store.get(id);
  if (!rec) {
    console.warn("[AI_DB] updateGenerated: record not found", id);
    return undefined;
  }

  const now = new Date().toISOString();
  const next: RequestRecord = {
    ...rec,
    status: "generated",
    design: payload.design,
    content: payload.content,
    updatedAt: now,
  };

  store.set(id, next);
  debugLog("updateGenerated", next);
  return next;
}

/**
 * プレビュー編集後、「この内容で確定して公開」時に
 * content を上書きし、slug を付与して published にする
 */
export function publishContent(
  id: string,
  content: Content
): { record?: RequestRecord; slug?: string } {
  const rec = store.get(id);
  if (!rec) {
    console.warn("[AI_DB] publishContent: record not found", id);
    return {};
  }

  const base = slugifyBase(
    rec.prompt.name || (rec.prompt as any).title || "portfolio"
  );
  const slug = ensureUniqueSlug(base);

  const now = new Date().toISOString();
  const next: RequestRecord = {
    ...rec,
    content,
    slug,
    status: "published",
    updatedAt: now,
  };

  store.set(id, next);
  slugIndex.set(slug, id);

  debugLog("publishContent", next);

  return { record: next, slug };
}

/**
 * ID指定で取得
 */
export function findRequest(id: string): RequestRecord | undefined {
  const rec = store.get(id);
  debugLog("findRequest", rec);
  return rec;
}

/**
 * slug 指定で取得（公開ページ用）
 */
export function getBySlug(slug: string): RequestRecord | undefined {
  const id = slugIndex.get(slug);
  if (!id) {
    console.log("[AI_DB] getBySlug: slug not found", slug);
    return undefined;
  }
  const rec = store.get(id);
  debugLog("getBySlug", rec);
  return rec;
}

/**
 * 全件リスト（管理UI 用）
 */
export function listAll(): RequestRecord[] {
  const list = Array.from(store.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  console.log("[AI_DB] listAll:", list.length, "records");
  return list;
}

