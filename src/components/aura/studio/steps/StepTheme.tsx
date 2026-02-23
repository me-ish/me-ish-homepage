// src/components/aura/studio/steps/StepTheme.tsx
'use client';

import ThemeSelector from '../ThemeSelector';
import type { StudioFormData } from '@/lib/aura/studio/studioTypes';

type Props = {
  form: StudioFormData;
  onChange: (patch: Partial<StudioFormData>) => void;
};

export default function StepTheme({ form, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">テーマを選ぶ</h2>
        <p className="text-sm text-gray-500 mt-1">
          ポートフォリオ全体の見た目を選択します。右のプレビューで確認できます。
        </p>
      </div>

      <ThemeSelector
        value={form.themeId}
        onChange={(themeId) => onChange({ themeId: themeId as StudioFormData['themeId'] })}
      />
    </div>
  );
}
