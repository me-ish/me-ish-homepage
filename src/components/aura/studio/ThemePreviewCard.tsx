// src/components/aura/studio/ThemePreviewCard.tsx
'use client';

import type { StudioTheme } from '@/lib/aura/studio/studioThemes';

type Props = {
  theme: StudioTheme;
  selected: boolean;
  onSelect: () => void;
};

export default function ThemePreviewCard({ theme, selected, onSelect }: Props) {
  const { colors, gradient, headerLayout } = theme;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'relative w-full rounded-xl border-2 overflow-hidden transition-all text-left',
        selected
          ? 'border-[#00a1e9] ring-2 ring-[#00a1e9]/30 shadow-lg'
          : 'border-transparent hover:border-gray-300',
      ].join(' ')}
      aria-pressed={selected}
    >
      {/* Mini preview */}
      <div
        className="w-full aspect-[4/3] relative"
        style={{ background: colors.bg }}
      >
        {/* Header area */}
        <div
          className="absolute inset-x-0 top-0 h-12 flex items-center px-3"
          style={{
            background: gradient ?? colors.surface,
            justifyContent: headerLayout === 'center' ? 'center' : 'flex-start',
          }}
        >
          <div className="flex flex-col gap-1" style={{ alignItems: headerLayout === 'center' ? 'center' : 'flex-start' }}>
            <div
              className="rounded-full"
              style={{ width: 24, height: 24, background: gradient ? 'rgba(255,255,255,0.3)' : colors.border }}
            />
            <div
              className="rounded"
              style={{ width: 40, height: 5, background: gradient ? 'rgba(255,255,255,0.5)' : colors.text, opacity: 0.5 }}
            />
          </div>
        </div>

        {/* Body cards */}
        <div className="absolute inset-x-2 top-14 bottom-2 flex gap-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 rounded"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                boxShadow: theme.shadow,
              }}
            />
          ))}
        </div>
      </div>

      {/* Label */}
      <div
        className="px-3 py-2"
        style={{ background: colors.surface, borderTop: `1px solid ${colors.border}` }}
      >
        <div className="font-semibold text-sm" style={{ color: colors.text }}>
          {theme.label}
        </div>
        <div className="text-xs mt-0.5" style={{ color: colors.muted }}>
          {theme.description}
        </div>
      </div>

      {/* Selected badge */}
      {selected && (
        <div className="absolute top-2 right-2 rounded-full bg-[#00a1e9] text-white text-[10px] font-bold px-2 py-0.5">
          選択中
        </div>
      )}
    </button>
  );
}
