// src/components/aura/studio/steps/StepProfile.tsx
'use client';

import AuraImageUploader from '@/components/aura/AuraImageUploader';
import type { StudioFormData } from '@/lib/aura/studio/studioTypes';

type Props = {
  form: StudioFormData;
  projectId: string | null;
  onChange: (patch: Partial<StudioFormData>) => void;
};

export default function StepProfile({ form, projectId, onChange }: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">プロフィール</h2>

      <div>
        <label className="block text-sm font-medium mb-1">
          名前 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
          placeholder="山田 太郎"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">肩書き・職種</label>
        <input
          type="text"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
          placeholder="フリーランスデザイナー / イラストレーター"
          value={form.displayTitle}
          onChange={(e) => onChange({ displayTitle: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">キャッチフレーズ</label>
        <input
          type="text"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
          placeholder="ビジュアルで世界を豊かにする"
          value={form.tagline}
          onChange={(e) => onChange({ tagline: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">自己紹介</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50 resize-none"
          placeholder="経歴・得意なこと・仕事への想いなど"
          rows={5}
          value={form.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">アバター画像</label>
        <AuraImageUploader
          value={
            form.avatarPreviewUrl || form.avatarPath
              ? [{ imageUrl: form.avatarPreviewUrl || `/api/aura/assets?path=${encodeURIComponent(form.avatarPath)}`, storagePath: form.avatarPath }]
              : []
          }
          onChange={(items) => {
            if (items.length > 0) {
              onChange({
                avatarPath: items[0].storagePath ?? '',
                avatarPreviewUrl: items[0].imageUrl,
              });
            } else {
              onChange({ avatarPath: '', avatarPreviewUrl: '' });
            }
          }}
          max={1}
          requestId={projectId}
          uploadEndpointBase="/api/aura/studio/upload/avatar"
        />
      </div>
    </div>
  );
}
