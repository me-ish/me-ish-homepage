// src/lib/aura/studio/studioDb.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { StudioFormData } from './studioTypes';

const TABLE = 'aura_projects';

/** ドラフト作成 */
export async function createStudioDraft(sessionToken: string, email?: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      session_token: sessionToken,
      email: email ?? null,
      status: 'draft',
    })
    .select('id, public_id, session_token')
    .single();

  if (error) throw error;
  return data;
}

/** IDでドラフト取得（session_tokenは呼び出し側で検証済み前提） */
export async function getStudioProject(id: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** public_idで公開ポートフォリオ取得 */
export async function getStudioProjectByPublicId(publicId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('public_id', publicId)
    .eq('visibility', 'public')
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** フォームデータを部分保存 */
export async function saveStudioDraft(
  id: string,
  form: Partial<StudioFormData>
) {
  const admin = supabaseAdmin();

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
  if (form.themeId !== undefined) patch.theme_id = form.themeId;
  if (form.accentColor !== undefined) patch.accent_color = form.accentColor;
  if (form.fontPreset !== undefined) patch.font_preset = form.fontPreset;

  const { error } = await admin.from(TABLE).update(patch).eq('id', id);
  if (error) throw error;
}

/** アバターパスをDBに保存 */
export async function updateStudioAvatarPath(id: string, avatarPath: string) {
  const admin = supabaseAdmin();
  const { error } = await admin
    .from(TABLE)
    .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 公開処理 */
export async function publishStudioProject(id: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
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
  return data;
}
