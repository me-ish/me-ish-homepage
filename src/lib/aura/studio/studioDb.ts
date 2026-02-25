// src/lib/aura/studio/studioDb.ts
// aura_projects は生成済み Database 型に未登録のため table name を any キャストで回避
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { StudioFormData } from './studioTypes';

const TABLE = 'aura_projects';

/** DB行の型（aura_projects テーブルの全カラム） */
export type AuraProjectRow = {
  id: string;
  session_token: string;
  email: string | null;
  name: string | null;
  display_title: string | null;
  tagline: string | null;
  bio: string | null;
  avatar_path: string | null;
  theme_id: string;
  accent_color: string | null;
  font_preset: string | null;
  layout_pref: string | null;
  works: unknown;
  services: unknown;
  skills: unknown;
  social: unknown;
  section_order: string[] | null;
  section_visibility: unknown;
  status: string;
  public_id: string;
  public_slug: string | null;
  visibility: string;
  published_at: string | null;
  payment_status: string;
  renderer_version: string;
  created_at: string;
  updated_at: string;
};

// aura_projects は Database 生成型に未登録のため untyped client 経由でアクセス
const db = () => (supabaseAdmin() as any).from(TABLE); // eslint-disable-line

/** ドラフト作成 */
export async function createStudioDraft(sessionToken: string, email?: string) {
  const { data, error } = await db()
    .insert({
      session_token: sessionToken,
      email: email ?? null,
      status: 'draft',
    })
    .select('id, public_id, session_token')
    .single();

  if (error) throw error;
  return data as { id: string; public_id: string; session_token: string };
}

/** IDでドラフト取得 */
export async function getStudioProject(id: string) {
  const { data, error } = await db()
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as AuraProjectRow | null;
}

/** public_idで公開ポートフォリオ取得 */
export async function getStudioProjectByPublicId(publicId: string) {
  const { data, error } = await db()
    .select('*')
    .eq('public_id', publicId)
    .eq('visibility', 'public')
    .maybeSingle();

  if (error) throw error;
  return data as AuraProjectRow | null;
}

/** フォームデータを部分保存 */
export async function saveStudioDraft(id: string, form: Partial<StudioFormData>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (form.name !== undefined) patch.name = form.name;
  if (form.displayTitle !== undefined) patch.display_title = form.displayTitle;
  if (form.tagline !== undefined) patch.tagline = form.tagline;
  if (form.bio !== undefined) patch.bio = form.bio;
  if (form.avatarPath !== undefined) patch.avatar_path = form.avatarPath;
  if (form.works !== undefined) patch.works = form.works;
  if (form.services !== undefined) patch.services = form.services;
  if (form.skills !== undefined) patch.skills = form.skills;
  if (form.social !== undefined) patch.social = form.social;
  if (form.sectionOrder !== undefined) patch.section_order = form.sectionOrder;
  if (form.sectionVisibility !== undefined) patch.section_visibility = form.sectionVisibility;
  if (form.themeId !== undefined) patch.theme_id = form.themeId;
  if (form.accentColor !== undefined) patch.accent_color = form.accentColor;
  if (form.fontPreset !== undefined) patch.font_preset = form.fontPreset;

  const { error } = await db().update(patch).eq('id', id);
  if (error) throw error;
}

/** アバターパスをDBに保存 */
export async function updateStudioAvatarPath(id: string, avatarPath: string) {
  const { error } = await db()
    .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 公開処理 */
export async function publishStudioProject(id: string) {
  const { data, error } = await db()
    .update({
      status: 'published',
      visibility: 'public',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('public_id')
    .single();

  if (error) throw error;
  return data as { public_id: string };
}
