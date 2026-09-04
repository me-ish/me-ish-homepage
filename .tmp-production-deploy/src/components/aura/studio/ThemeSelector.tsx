// src/components/aura/studio/ThemeSelector.tsx
'use client';

import { STUDIO_THEME_LIST } from '@/lib/aura/studio/studioThemes';
import ThemePreviewCard from './ThemePreviewCard';

type Props = {
  value: string;
  onChange: (themeId: string) => void;
};

export default function ThemeSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {STUDIO_THEME_LIST.map((theme) => (
        <ThemePreviewCard
          key={theme.id}
          theme={theme}
          selected={value === theme.id}
          onSelect={() => onChange(theme.id)}
        />
      ))}
    </div>
  );
}
