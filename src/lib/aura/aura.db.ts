// src/lib/aiPortfolio/aura.db.ts
import type { FormInput, Design, Content } from "./aura.schema";
import { supabaseAdmin } from "@/lib/aura/supabaseAdmin";

// aura_requests.status の実態に合わせる
export type RequestStatus = "draft" | "generated" | "error" | "published";

/* ---------------------------------------------------------
 * Renderer Version 管理
 * --------------------------------------------------------- */

/**
 * 現在の Renderer バージョン（SemVer）
 * - 新規確定時にこの値が刻印される
 * - MAJOR 変更時は v2 ディレクトリを用意してから上げる
 */
export const CURRENT_RENDERER_VERSION = "1.0.0" as const;

/**
 * SemVer 文字列から MAJOR バージョンを抽出
 */
export function getMajorVersion(version: string | null | undefined): number {
  if (!version) return 1;
  const [major] = version.split(".");
  const parsed = parseInt(major, 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

// DBの実カラムに合わせて拡張（/aura/p 統合のため）
export type RequestVisibility = "public" | "private" | string;

export type RequestRecord = {
  id: string;
  email?: string | null;
  status: RequestStatus;

  // 旧互換
  slug?: string | null;

  // ✅ public_slug方式（公開URLの人間可読キー）
  publicSlug?: string | null;

  // ✅ 公開用キー（UUID）
  publicId?: string | null;
  visibility?: string | null;
  publishedAt?: string | null;

  prompt?: FormInput | null;
  design?: Design | null;
  content?: Content | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;

  // ✅ Renderer Version（買い切り固定化）
  rendererVersion: string;
};

/* ---------------------------------------------------------
 * 補助関数（slug/sectionOrder正規化）
 * --------------------------------------------------------- */

// 旧互換 slug 用（underscore を許す）
function slugifyBase(name: string) {
  return (name ?? "")
    .trim()
    .toLowerCase()
    // 英数字/アンダースコア以外は - へ
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

// public_slug 用（underscore を許さない：a-z0-9- のみ）
function normalizePublicSlug(input: string) {
  return (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

/**
 * sectionOrder を正規化：
 * - 重複排除
 * - content.sections に存在する type のみ許可
 * - 末尾に「漏れた type」を追記して必ず全セクションが並ぶようにする
 */
function normalizeSectionOrder(content: Content, sectionOrder?: string[]) {
  const contentTypes = uniq(content.sections.map((s) => s.type));
  const preferred = uniq(Array.isArray(sectionOrder) ? sectionOrder : []).filter(
    (t) => contentTypes.includes(t),
  );
  const rest = contentTypes.filter((t) => !preferred.includes(t));
  return [...preferred, ...rest];
}

// ✅ Node/Edge差分に強いUUID生成（db.tsはサーバー側のみで使う前提）
async function uuidV4(): Promise<string> {
  const g: any = globalThis as any;

  // 1) Web Crypto (Edge でも Node でも使える場合がある)
  if (g?.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }

  // 2) Node crypto
  const mod = await import("crypto");
  return mod.randomUUID();
}

function mapDbToRecord(row: any): RequestRecord {
  return {
    id: String(row.id),
    email: row.email ?? null,
    status: row.status as RequestStatus,

    // 旧互換
    slug: row.slug ?? null,

    // ✅ public_slug方式
    publicSlug: row.public_slug ?? null,

    // ✅ 公開キー
    publicId: row.public_id ?? null,
    visibility: row.visibility ?? null,
    publishedAt: row.published_at ?? null,

    prompt: (row.payload ?? null) as FormInput | null,
    design: (row.design ?? null) as Design | null,
    content: (row.content ?? null) as Content | null,
    error: row.error ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),

    // ✅ Renderer Version（DB default '1.0.0' により既存も自動対応）
    rendererVersion: row.renderer_version ?? "1.0.0",
  };
}

/* ---------------------------------------------------------
 * API（Supabase）
 * --------------------------------------------------------- */

/**
 * フォーム送信直後（生成前）のレコード作成（互換用）
 * - sessionToken を受け取った場合は aura_requests.session_token に保存
 */
export async function insertDraft(data: {
  email: string;
  prompt: FormInput;
  sessionToken?: string; // ✅ 追加
}): Promise<RequestRecord> {
  const supabase = supabaseAdmin();

  const { data: created, error } = await supabase
    .from("aura_requests")
    .insert({
      status: "draft",
      email: data.email ?? null,
      payload: data.prompt,
      design: null,
      content: null,
      error: null,
      slug: null,
      public_slug: null,

      // ✅ 所有確認用トークン（Cookie側と一致させる）
      session_token: data.sessionToken ?? null,

      // public_id / visibility / published_at は公開時に確定でOK
    })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`insertDraft_failed:${error?.message ?? "unknown"}`);
  }

  return mapDbToRecord(created);
}

/**
 * design / content 生成後に generated へ更新（互換用）
 */
export async function updateGenerated(
  id: string,
  payload: { design: Design; content: Content },
): Promise<RequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("aura_requests")
    .update({
      status: "generated",
      design: payload.design,
      content: payload.content,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[AI_DB] updateGenerated failed", id, error);
    return undefined;
  }

  return mapDbToRecord(data);
}

/**
 * payload の一部更新（ミューテート関数で安全に更新）
 */
export async function updateRequestPayload(
  id: string,
  mutate: (prev: any) => any,
): Promise<void> {
  const supabase = supabaseAdmin();

  const { data: row, error: e1 } = await supabase
    .from("aura_requests")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (e1) throw new Error(`payload_fetch_failed:${e1.message}`);

  const prev = row?.payload ?? {};
  const next = mutate(prev);
  const safeNext = next ?? prev ?? {};

  const { error: e2 } = await supabase
    .from("aura_requests")
    .update({
      payload: safeNext,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (e2) throw new Error(`payload_update_failed:${e2.message}`);
}

/**
 * payload の“パッチ更新”版
 */
export async function updatePayloadFields(
  id: string,
  patch: Record<string, any>,
): Promise<void> {
  await updateRequestPayload(id, (prev: any) => ({
    ...(prev ?? {}),
    ...(patch ?? {}),
  }));
}

/* ---------------------------------------------------------
 * slug / public_slug 採番ヘルパー
 * --------------------------------------------------------- */

async function pickUniqueLegacySlug(
  supabase: any,
  base: string,
  excludeId: string,
): Promise<string> {
  const cleaned = slugifyBase(base) || "portfolio";

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? cleaned : `${cleaned}-${i + 1}`;
    const { data: hit, error } = await supabase
      .from("aura_requests")
      .select("id")
      .eq("slug", candidate)
      .neq("id", excludeId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[AI_DB] legacy slug check failed", candidate, error);
      continue;
    }
    if (!hit) return candidate;
  }

  return `${cleaned}-${excludeId.slice(0, 6)}`;
}

async function pickUniquePublicSlug(
  supabase: any,
  base: string,
  excludeId: string,
): Promise<string> {
  const cleaned = normalizePublicSlug(base) || "portfolio";

  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? cleaned : `${cleaned}-${i + 1}`;

    const { data: hit, error } = await supabase
      .from("aura_requests")
      .select("id")
      .eq("public_slug", candidate)
      .neq("id", excludeId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[AI_DB] public_slug check failed", candidate, error);
      continue;
    }

    if (!hit) return candidate;
  }

  return `${cleaned}-${excludeId.slice(0, 6)}`;
}

/**
 * ✅ 公開（content確定 + sectionOrder永続化 + public_id/public_slug確定）
 *
 * - design.layoutDecision.sectionOrder に正規化して永続化
 * - public_id は既存があれば維持、なければ新規採番
 * - public_slug は既存があれば維持、なければ name 由来で衝突回避採番
 * - visibility='public' & published_at をセット
 */
export async function publishContent(
  id: string,
  content: Content,
  sectionOrder?: string[],
): Promise<{
  record?: RequestRecord;
  slug?: string; // 旧互換
  publicId?: string;
  publicSlug?: string;
}> {
  const supabase = supabaseAdmin();

  const current = await findRequest(id);
  if (!current) return {};

  const normalizedOrder = normalizeSectionOrder(content, sectionOrder);

  // design が無いケースでも壊さない
  const nextDesign: any = current.design
    ? JSON.parse(JSON.stringify(current.design))
    : null;

  if (nextDesign) {
    nextDesign.layoutDecision = {
      ...(nextDesign.layoutDecision ?? {}),
      sectionOrder: normalizedOrder,
    };
  }

  const baseName =
    (current.prompt?.name as string | undefined) ??
    ((current.prompt as any)?.title as string | undefined) ??
    "portfolio";

  // ✅ public_id 確定
  const publicId = current.publicId ?? (await uuidV4());

  // ✅ legacy slug（旧互換）も、無いなら衝突回避して採番
  const legacySlug =
    current.slug ??
    (await pickUniqueLegacySlug(supabase, baseName, id));

  // ✅ public_slug 確定（既存があれば維持、無ければ衝突回避採番）
  const publicSlug =
    current.publicSlug ??
    (await pickUniquePublicSlug(supabase, baseName, id));

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("aura_requests")
    .update({
      status: "published",

      // 旧互換
      slug: legacySlug,

      // ✅ public_slug方式
      public_slug: publicSlug,

      // ✅ 公開必須要件
      public_id: publicId,
      visibility: "public",
      published_at: nowIso,

      content,
      design: nextDesign ?? current.design ?? null,
      error: null,
      updated_at: nowIso,

      // ✅ Renderer Version 刻印（買い切り固定化）
      renderer_version: CURRENT_RENDERER_VERSION,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[AI_DB] publishContent failed", id, error);
    return {};
  }

  const record = mapDbToRecord(data);
  return {
    record,
    slug: record.slug ?? undefined,
    publicId: record.publicId ?? undefined,
    publicSlug: record.publicSlug ?? undefined,
  };
}

/**
 * ID指定で取得
 */
export async function findRequest(
  id: string,
): Promise<RequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("aura_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

/**
 * slug 指定で取得（旧互換）
 */
export async function getBySlug(
  slug: string,
): Promise<RequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("aura_requests")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

/**
 * ✅ public_slug 指定で取得（/aura/p/[key] で使う）
 */
export async function getByPublicSlug(
  publicSlug: string,
): Promise<RequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("aura_requests")
    .select("*")
    .eq("public_slug", publicSlug)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

/**
 * public_id 指定で取得（互換）
 */
export async function getByPublicId(
  publicId: string,
): Promise<RequestRecord | undefined> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("aura_requests")
    .select("*")
    .eq("public_id", publicId)
    .maybeSingle();

  if (error || !data) return undefined;
  return mapDbToRecord(data);
}

/**
 * 全件リスト（管理UI 用）
 */
export async function listAll(): Promise<RequestRecord[]> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("aura_requests")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(mapDbToRecord);
}
