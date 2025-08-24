// components/ProfileEditModal.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Upload, Image as Img } from 'lucide-react';

type SNS = { homepage?: string; twitter?: string; instagram?: string };

type Props = {
  initialProfile: {
    display_name: string;
    bio?: string;
    avatar_url?: string;
    banner_url?: string;
    sns_links: SNS;
  };
  onSave: (updated: {
    display_name: string;
    bio?: string;
    avatar_url?: string;
    banner_url?: string;
    sns_links: SNS;
  }) => void;
  onCancel: () => void;
};

export default function ProfileEditModal({ initialProfile, onSave, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(initialProfile.display_name || '');
  const [bio, setBio] = useState(initialProfile.bio || '');
  const [homepage, setHomepage] = useState(initialProfile.sns_links?.homepage || '');
  const [twitter, setTwitter] = useState(initialProfile.sns_links?.twitter || '');
  const [instagram, setInstagram] = useState(initialProfile.sns_links?.instagram || '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(initialProfile.banner_url || '');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 画像プレビュー
  const avatarPreview = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl || ''),
    [avatarFile, avatarUrl]
  );
  const bannerPreview = useMemo(
    () => (bannerFile ? URL.createObjectURL(bannerFile) : bannerUrl || ''),
    [bannerFile, bannerUrl]
  );

  // ESCで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // 外側クリックで閉じる
  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('ユーザー情報が見つかりません');

      // 画像アップロード（あれば）
      let uploadedAvatar = avatarUrl;
      let uploadedBanner = bannerUrl;

      if (avatarFile) {
        uploadedAvatar = await uploadToBucket('avatars', uid, avatarFile);
        setAvatarUrl(uploadedAvatar);
      }
      if (bannerFile) {
        uploadedBanner = await uploadToBucket('banners', uid, bannerFile);
        setBannerUrl(uploadedBanner);
      }

      const payload = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: uploadedAvatar,
        banner_url: uploadedBanner,
        sns_links: {
          homepage: normalizeUrl(homepage),
          twitter: normalizeTwitter(twitter),
          instagram: normalizeInstagram(instagram),
        } as SNS,
      };

      onSave(payload); // ← 呼び出し元（MyPage）が Supabase UPDATE します
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={onOverlayClick}
      className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-[1px] grid place-items-center px-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">プロフィールを編集</h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-[#f6f8fb]" aria-label="閉じる">
            <X className="w-5 h-5 text-[#667]" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* バナー */}
          <div>
            <label className="block text-sm font-semibold mb-1">バナー画像（推奨 1600×400）</label>
            <div className="relative h-28 w-full rounded-xl bg-[#f6f8fb] overflow-hidden border">
              {bannerPreview ? (
                <img src={bannerPreview} alt="banner" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-[#99a]"><Img className="w-5 h-5" /></div>
              )}
              <label className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white border px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-[#f7fbff]">
                <Upload className="w-3.5 h-3.5 text-[#00a1e9]" /> 画像を選択
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          {/* アバター */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-[#f1f5f9] overflow-hidden border">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-[#99a]"><Img className="w-5 h-5" /></div>
              )}
            </div>
            <label className="inline-flex items-center gap-1 rounded-full bg-white border px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-[#f7fbff]">
              <Upload className="w-3.5 h-3.5 text-[#00a1e9]" /> アバターを選択
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {/* 表示名 */}
          <div>
            <label className="block text-sm font-semibold mb-1">表示名</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/20"
              placeholder="例：K. Suzuki"
              maxLength={64}
            />
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
            <div className="text-right text-xs text-[#667] mt-1">{bio.length}/280</div>
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
                placeholder="https://instagram.com/yourname"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <button onClick={onCancel} className="px-4 py-2 rounded-full border bg-white hover:bg-[#f7fbff]">キャンセル</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-full bg-[#00a1e9] text-white font-semibold hover:brightness-[1.05] disabled:opacity-60"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

async function uploadToBucket(bucket: 'avatars' | 'banners', uid: string, file: File) {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${uid}/${bucket}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return pub.publicUrl; // 公開URL（必要に応じてRLS/署名URLに変更可）
}

function normalizeUrl(v?: string) {
  if (!v) return '';
  let url = v.trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
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
