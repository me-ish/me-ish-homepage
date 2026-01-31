// components/ProfileEditModal.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  X,
  Upload,
  Image as Img,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

type SNS = { homepage?: string; twitter?: string; instagram?: string };

type Props = {
  initialProfile: {
    display_name: string;
    banner_focus_x?: number | null;
    banner_focus_y?: number | null;
    banner_zoom?: number | null;
    bio?: string | null;          // ← null を許容
    avatar_url?: string | null;   // ← ここ
    banner_url?: string | null;   // ← ここ
    sns_links?: SNS | null;       // ← 運用上 null の可能性も許容
  };
  onSave: (updated: {
    display_name: string;
    banner_focus_x?: number | null;
    banner_focus_y?: number | null;
    banner_zoom?: number | null;
    bio?: string | null;          // ← ここ
    avatar_url?: string | null;   // ← ここ
    banner_url?: string | null;   // ← ここ
    sns_links: SNS;
  }) => Promise<void> | void;
  onCancel: () => void;
};


const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_MB = 8;
const BANNER_ZOOM_MIN = 0.5;
const BANNER_ZOOM_MAX = 2.5;

export default function ProfileEditModal({ initialProfile, onSave, onCancel }: Props) {
  // form states
  const [displayName, setDisplayName] = useState(initialProfile.display_name || '');
  const [bio, setBio] = useState(initialProfile.bio || '');
  const [homepage, setHomepage] = useState(initialProfile.sns_links?.homepage || '');
  const [twitter, setTwitter] = useState(initialProfile.sns_links?.twitter || '');
  const [instagram, setInstagram] = useState(initialProfile.sns_links?.instagram || '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(initialProfile.banner_url || '');
  const [bannerFocusX, setBannerFocusX] = useState<number>(
    initialProfile.banner_focus_x ?? 0.5
  );
  const [bannerFocusY, setBannerFocusY] = useState<number>(
    initialProfile.banner_focus_y ?? 0.5
  );
  const [bannerZoom, setBannerZoom] = useState<number>(
    initialProfile.banner_zoom ?? 1
  );

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // ui states
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [draggingBanner, setDraggingBanner] = useState(false);
  const [draggingAvatar, setDraggingAvatar] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const displayInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // previews
  const avatarPreview = useObjectUrl(avatarFile) ?? avatarUrl ?? '';
  const bannerPreview = useObjectUrl(bannerFile) ?? bannerUrl ?? '';

  // 初期フォーカス
  useEffect(() => {
    displayInputRef.current?.focus();
  }, []);

  // ESCで閉じる（未保存ガード付き）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
      // Ctrl/Cmd + S で保存
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayName,
    bio,
    homepage,
    twitter,
    instagram,
    avatarFile,
    bannerFile,
    avatarUrl,
    bannerUrl,
    bannerFocusX,
    bannerFocusY,
    bannerZoom,
  ]);

  // 外側クリックで閉じる（未保存ガード付き）
  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) tryClose();
  };

  // 入力変化でdirty管理
  useEffect(() => {
    const changed =
      (initialProfile.display_name || '') !== displayName ||
      (initialProfile.bio || '') !== bio ||
      (initialProfile.sns_links?.homepage || '') !== homepage ||
      (initialProfile.sns_links?.twitter || '') !== twitter ||
      (initialProfile.sns_links?.instagram || '') !== instagram ||
      (initialProfile.avatar_url || '') !== avatarUrl ||
      (initialProfile.banner_url || '') !== bannerUrl ||
      (initialProfile.banner_focus_x ?? 0.5) !== bannerFocusX ||
      (initialProfile.banner_focus_y ?? 0.5) !== bannerFocusY ||
      (initialProfile.banner_zoom ?? 1) !== bannerZoom ||
      !!avatarFile || !!bannerFile;
    setDirty(changed);
  }, [
    displayName,
    bio,
    homepage,
    twitter,
    instagram,
    avatarUrl,
    bannerUrl,
    bannerFocusX,
    bannerFocusY,
    bannerZoom,
    avatarFile,
    bannerFile,
    initialProfile,
  ]);

  // DnD: 共通ハンドラ
  const handleDrop = (e: React.DragEvent, kind: 'avatar' | 'banner') => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.files?.length) return;
    const f = e.dataTransfer.files[0];
    const err = validateImage(f);
    if (err) return setErrors([err]);
    if (kind === 'avatar') setAvatarFile(f);
    else setBannerFile(f);
    setDraggingAvatar(false);
    setDraggingBanner(false);
  };

  const handleDragOver = (e: React.DragEvent, kind: 'avatar' | 'banner') => {
    e.preventDefault();
    e.stopPropagation();
    if (kind === 'avatar') setDraggingAvatar(true);
    else setDraggingBanner(true);
  };
  const handleDragLeave = (kind: 'avatar' | 'banner') => {
    if (kind === 'avatar') setDraggingAvatar(false);
    else setDraggingBanner(false);
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>, kind: 'avatar' | 'banner') => {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validateImage(f);
    if (err) return setErrors([err]);
    if (kind === 'avatar') setAvatarFile(f);
    else setBannerFile(f);
  };

  const handleRemoveImage = (kind: 'avatar' | 'banner') => {
    if (kind === 'avatar') {
      setAvatarFile(null);
      setAvatarUrl('');
    } else {
      setBannerFile(null);
      setBannerUrl('');
      setBannerFocusX(0.5);
      setBannerFocusY(0.5);
      setBannerZoom(1);
    }
    setDirty(true);
  };

  // 保存
  const handleSave = async () => {
    setErrors([]);
    const vErrors = validateForm(displayName, bio, homepage, twitter, instagram);
    if (vErrors.length) {
      setErrors(vErrors);
      return;
    }

    setSaving(true);
    try {
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = userData.user?.id;
      if (!uid) throw new Error('ユーザー情報が見つかりません');

      // 画像アップロード（あれば）
      let uploadedAvatar = avatarUrl;
      let uploadedBanner = bannerUrl;

      if (avatarFile) {
        uploadedAvatar = await uploadImage('avatars', uid, avatarFile);
        setAvatarUrl(uploadedAvatar);
      }
      if (bannerFile) {
        uploadedBanner = await uploadImage('banners', uid, bannerFile);
        setBannerUrl(uploadedBanner);
      }

      // 正規化
      const payload = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: uploadedAvatar || null,
        banner_url: uploadedBanner || null,
        banner_focus_x: bannerFocusX,
        banner_focus_y: bannerFocusY,
        banner_zoom: bannerZoom,
        sns_links: {
          homepage: normalizeUrl(homepage),
          twitter: normalizeTwitter(twitter),
          instagram: normalizeInstagram(instagram),
        } as SNS,
      };

      // 呼び出し元に渡す（DB更新は親で統一）
      await Promise.resolve(onSave(payload));
    } catch (e) {
      console.error(e);
      setErrors(['保存に失敗しました。お手数ですが時間をおいて再度お試しください。']);
    } finally {
      setSaving(false);
    }
  };

  // 未保存ガード
  const tryClose = () => {
    if (dirty && !confirm('変更が保存されていません。閉じてもよろしいですか？')) {
      return;
    }
    onCancel();
  };

  // === return() 以降の JSX を丸ごと置き換え ===
return (
  <div
    ref={overlayRef}
    onClick={onOverlayClick}
    className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-[1px] overflow-y-auto"
    aria-modal="true"
    role="dialog"
  >
    {/* iOS/Android で上下に逃がす（100svh対応） */}
    <div className="min-h-[100svh] flex items-start justify-center px-4 py-4 sm:py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden flex flex-col max-h-[calc(100svh-2rem)] sm:max-h-[calc(100vh-4rem)]">
        {/* Header（常に見える） */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b bg-white">
          <h2 className="text-lg font-semibold">プロフィールを編集</h2>
          <button
            onClick={tryClose}
            className="p-1 rounded hover:bg-gray-50"
            aria-label="閉じる"
            type="button"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body（ここだけスクロール） */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5 sm:space-y-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {/* エラー */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div>
                {errors.map((e, i) => (
                  <div key={i}>• {e}</div>
                ))}
              </div>
            </div>
          )}

          {/* バナー */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              バナー画像（推奨 1600×400, PNG/JPEG/WebP, 〜{MAX_FILE_MB}MB）
            </label>
            <div
              className={[
                "relative h-48 md:h-56 w-full rounded-xl border overflow-hidden",
                draggingBanner ? "ring-2 ring-[#00a1e9] border-[#00a1e9]" : "bg-gray-50",
              ].join(" ")}
              onDrop={(e) => handleDrop(e, "banner")}
              onDragOver={(e) => handleDragOver(e, "banner")}
              onDragLeave={() => handleDragLeave("banner")}
            >
              {bannerPreview ? (
                <img
                  src={bannerPreview}
                  alt="banner"
                  className="h-full w-full object-cover"
                  style={{
                    transform: `scale(${bannerZoom})`,
                    transformOrigin: `${bannerFocusX * 100}% ${bannerFocusY * 100}%`,
                    objectPosition: `${bannerFocusX * 100}% ${bannerFocusY * 100}%`,
                  }}
                />
              ) : (
                <div className="h-full w-full grid place-items-center text-gray-400">
                  <Img className="w-5 h-5" />
                  <span className="text-xs mt-1">ここにドラッグ＆ドロップ</span>
                </div>
              )}

              {/* ✅ ボタン順序を「選択 → 削除」に統一 */}
              <div className="absolute bottom-2 right-2 flex gap-2">
                <label className="inline-flex items-center gap-1 rounded-full bg-white border px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-blue-50">
                  <Upload className="w-3.5 h-3.5 text-[#00a1e9]" /> 画像を選択
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept={ACCEPTED_MIME.join(",")}
                    className="hidden"
                    onChange={(e) => handleSelectFile(e, "banner")}
                  />
                </label>

                {!!bannerPreview && (
                  <button
                    onClick={() => handleRemoveImage("banner")}
                    className="inline-flex items-center gap-1 rounded-full bg-white border px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" /> 画像を削除
                  </button>
                )}
              </div>
            </div>
            {bannerPreview && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-600 w-20">Zoom</label>
                  <input
                    type="range"
                    min={BANNER_ZOOM_MIN}
                    max={BANNER_ZOOM_MAX}
                    step={0.05}
                    value={bannerZoom}
                    onChange={(e) => setBannerZoom(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {bannerZoom.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-600 w-20">Pos X</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={bannerFocusX}
                    onChange={(e) => setBannerFocusX(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {Math.round(bannerFocusX * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-600 w-20">Pos Y</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={bannerFocusY}
                    onChange={(e) => setBannerFocusY(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {Math.round(bannerFocusY * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* アバター */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              アバター（推奨 正方形, PNG/JPEG/WebP, 〜{MAX_FILE_MB}MB）
            </label>
            <div className="flex items-center gap-4">
              <div
                className={[
                  "h-16 w-16 rounded-full bg-[#f1f5f9] overflow-hidden border",
                  draggingAvatar ? "ring-2 ring-[#00a1e9] border-[#00a1e9]" : "",
                ].join(" ")}
                onDrop={(e) => handleDrop(e, "avatar")}
                onDragOver={(e) => handleDragOver(e, "avatar")}
                onDragLeave={() => handleDragLeave("avatar")}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center text-gray-400">
                    <Img className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* ✅ こちらも「選択 → 削除」 */}
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1 rounded-full bg-white border px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-blue-50">
                  <Upload className="w-3.5 h-3.5 text-[#00a1e9]" /> 画像を選択
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept={ACCEPTED_MIME.join(",")}
                    className="hidden"
                    onChange={(e) => handleSelectFile(e, "avatar")}
                  />
                </label>

                {!!avatarPreview && (
                  <button
                    onClick={() => handleRemoveImage("avatar")}
                    className="inline-flex items-center gap-1 rounded-full bg-white border px-3 py-1.5 text-xs font-semibold hover:bg-red-50"
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" /> 画像を削除
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 表示名 */}
          <div>
            <label className="block text-sm font-semibold mb-1">表示名（必須 / 最大 64文字）</label>
            <input
              ref={displayInputRef}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/20"
              placeholder="例：K. Suzuki"
              maxLength={64}
              required
            />
            <div className="text-right text-xs text-gray-500 mt-1">{displayName.length}/64</div>
          </div>

          {/* 自己紹介 */}
          <div>
            <label className="block text-sm font-semibold mb-1">自己紹介（最大 280文字）</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 h-28 resize-none focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/20"
              maxLength={280}
              placeholder="作品のテーマや制作環境、受注の可否などを書いておくと見られやすくなります。"
            />
            <div className="text-right text-xs text-gray-500 mt-1">{bio.length}/280</div>
          </div>

          {/* SNS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">ホームページ</label>
              <input
                value={homepage}
                onChange={(e) => setHomepage(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">X（Twitter）</label>
              <input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="https://x.com/yourname or @yourname"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Instagram</label>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="https://instagram.com/yourname or @"
              />
            </div>
          </div>
        </div>

        {/* Footer（常に見える + safe-area） */}
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 px-5 py-4 border-t bg-white pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <button
            onClick={tryClose}
            className="px-4 py-2 rounded-full border bg-white hover:bg-blue-50"
            type="button"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-full bg-[#00a1e9] text-white font-semibold hover:brightness-[1.05] disabled:opacity-60 inline-flex items-center gap-2"
            type="button"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "保存中…" : "保存（⌘/Ctrl+S）"}
          </button>
        </div>
      </div>
    </div>
  </div>
);
}

/* ---------------- helpers ---------------- */

function validateImage(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type)) return '対応していない画像形式です（PNG/JPEG/WebP）';
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_FILE_MB) return `画像サイズが大きすぎます（最大 ${MAX_FILE_MB}MB）`;
  return null;
}

async function uploadImage(bucket: 'avatars' | 'banners', uid: string, file: File) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${uid}/${bucket}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return pub.publicUrl;
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function validateForm(
  displayName: string,
  bio: string,
  homepage?: string,
  twitter?: string,
  instagram?: string
): string[] {
  const errs: string[] = [];
  if (!displayName.trim()) errs.push('表示名は必須です。');
  if (displayName.length > 64) errs.push('表示名は64文字以内で入力してください。');
  if (bio.length > 280) errs.push('自己紹介は280文字以内で入力してください。');

  const urlish = (v?: string) => v && v.trim().length > 0;
  if (urlish(homepage) && !looksLikeUrl(homepage!)) errs.push('ホームページURLの形式が正しくありません。');
  if (urlish(twitter) && !looksLikeUrlOrAt(twitter!)) errs.push('X（Twitter）はURLまたは @ユーザー名 で指定してください。');
  if (urlish(instagram) && !looksLikeUrlOrAt(instagram!)) errs.push('InstagramはURLまたは @ユーザー名 で指定してください。');

  return errs;
}

function looksLikeUrl(v: string) {
  return /^https?:\/\//i.test(v.trim());
}

function looksLikeUrlOrAt(v: string) {
  const s = v.trim();
  return /^https?:\/\//i.test(s) || /^@?[A-Za-z0-9._-]+$/.test(s);
}

function normalizeUrl(v?: string) {
  if (!v) return '';
  let url = v.trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
  return url;
}
function normalizeTwitter(v?: string) {
  if (!v) return '';
  let s = v.trim().replace(/^@/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://x.com/${s}`;
  return s;
}
function normalizeInstagram(v?: string) {
  if (!v) return '';
  let s = v.trim().replace(/^@/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://instagram.com/${s}`;
  return s;
}
