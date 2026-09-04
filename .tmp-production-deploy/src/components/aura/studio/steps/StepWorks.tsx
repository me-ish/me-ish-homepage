// src/components/aura/studio/steps/StepWorks.tsx
'use client';

import AuraImageUploader from '@/components/aura/AuraImageUploader';
import type { StudioFormData, WorkItem } from '@/lib/aura/studio/studioTypes';
import type { AuraImageItem } from '@/components/aura/AuraImageUploader';

type Props = {
  form: StudioFormData;
  projectId: string | null;
  onChange: (patch: Partial<StudioFormData>) => void;
};

function workToAuraItem(w: WorkItem): AuraImageItem {
  return {
    imageUrl: w.imageUrl,
    storagePath: w.storagePath,
    title: w.title,
    description: w.description,
  };
}

function auraItemToWork(item: AuraImageItem): WorkItem {
  return {
    imageUrl: item.imageUrl,
    storagePath: item.storagePath ?? '',
    title: item.title,
    description: item.description,
  };
}

export default function StepWorks({ form, projectId, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">作品・実績</h2>
        <p className="text-sm text-gray-500 mt-1">
          最大5枚まで追加できます。最初の1枚がカバー画像になります。
        </p>
      </div>

      {!projectId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          画像をアップロードするには、まず「はじめる」を押してプロジェクトを作成してください。
        </div>
      )}

      <AuraImageUploader
        value={form.works.map(workToAuraItem)}
        onChange={(items) => onChange({ works: items.map(auraItemToWork) })}
        max={5}
        requestId={projectId}
        uploadEndpointBase="/api/aura/studio/upload/works"
      />
    </div>
  );
}
