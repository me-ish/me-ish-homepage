// src/components/aura/studio/StudioPreview.tsx
'use client';

import type { StudioFormData, SectionId } from '@/lib/aura/studio/studioTypes';
import { DEFAULT_SECTION_ORDER } from '@/lib/aura/studio/studioTypes';
import { getTheme } from '@/lib/aura/studio/studioThemes';
import { Globe, Twitter } from 'lucide-react';

type Props = {
  form: StudioFormData;
};

export default function StudioPreview({ form }: Props) {
  const theme = getTheme(form.themeId);
  const { colors } = theme;
  const accent = form.accentColor;

  const sectionOrder: SectionId[] = form.sectionOrder?.length ? form.sectionOrder : DEFAULT_SECTION_ORDER;
  const sectionVisibility = form.sectionVisibility ?? {};

  // セクション別レンダラー
  const sectionMap: Record<SectionId, React.ReactNode> = {
    bio: form.bio ? (
      <section key="bio" className="px-6 py-5" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
          About
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: colors.text }}>
          {form.bio}
        </p>
      </section>
    ) : null,

    works: form.works.length > 0 ? (
      <section key="works" className="px-6 py-5" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>
          Works
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {form.works.slice(0, 4).map((w, i) => (
            <div
              key={i}
              className="overflow-hidden"
              style={{ borderRadius: theme.radius, background: colors.surface }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={w.imageUrl}
                alt={w.title ?? `work-${i + 1}`}
                className="w-full h-16 object-cover"
              />
              {w.title && (
                <p className="px-2 py-1 text-[10px] truncate" style={{ color: colors.text }}>
                  {w.title}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    ) : null,

    services: form.services.filter((s) => s.name).length > 0 ? (
      <section key="services" className="px-6 py-5" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>
          Services
        </h2>
        <div className="space-y-2">
          {form.services.filter((s) => s.name).map((svc, i) => (
            <div
              key={i}
              className="px-3 py-2"
              style={{
                background: colors.surface,
                borderRadius: theme.radius,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="font-semibold text-xs" style={{ color: colors.text }}>
                {svc.name}
              </div>
              {svc.price && (
                <div className="text-[10px] mt-0.5 font-medium" style={{ color: accent }}>
                  {svc.price}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    ) : null,

    skills: form.skills.length > 0 ? (
      <section key="skills" className="px-6 py-5" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>
          Skills
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {form.skills.map((skill) => (
            <span
              key={skill}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
    ) : null,

    contact: (form.social.twitter || form.social.instagram || form.social.website) ? (
      <section key="contact" className="px-6 py-5">
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>
          Contact
        </h2>
        <div className="flex flex-col gap-2">
          {form.social.twitter && (
            <a
              href={form.social.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs"
              style={{ color: accent }}
            >
              <Twitter className="w-3 h-3" /> X
            </a>
          )}
          {form.social.website && (
            <a
              href={form.social.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs"
              style={{ color: accent }}
            >
              <Globe className="w-3 h-3" /> Web
            </a>
          )}
        </div>
      </section>
    ) : null,
  };

  return (
    <div
      className="h-full overflow-y-auto text-sm"
      style={{ background: colors.bg, color: colors.text, fontFamily: 'sans-serif' }}
    >
      {/* Hero（常に先頭・固定） */}
      <section
        className="px-6 py-8"
        style={{
          background: theme.gradient ?? colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          textAlign: theme.headerLayout === 'center' ? 'center' : 'left',
        }}
      >
        {form.avatarPreviewUrl || form.avatarPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.avatarPreviewUrl || `/api/aura/assets?path=${encodeURIComponent(form.avatarPath)}`}
            alt="avatar"
            className="rounded-full object-cover"
            style={{
              width: 72, height: 72,
              display: theme.headerLayout === 'center' ? 'block' : 'inline-block',
              margin: theme.headerLayout === 'center' ? '0 auto 12px' : '0 0 12px',
              border: `3px solid ${accent}`,
            }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center text-lg font-bold"
            style={{
              width: 72, height: 72,
              background: accent,
              color: '#fff',
              display: theme.headerLayout === 'center' ? 'flex' : 'inline-flex',
              margin: theme.headerLayout === 'center' ? '0 auto 12px' : '0 0 12px',
            }}
          >
            {(form.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <h1
          className="font-bold text-xl leading-tight"
          style={{ color: theme.gradient ? '#fff' : colors.text }}
        >
          {form.name || '名前未入力'}
        </h1>
        {form.displayTitle && (
          <p className="mt-1 text-sm font-medium" style={{ color: theme.gradient ? 'rgba(255,255,255,0.85)' : accent }}>
            {form.displayTitle}
          </p>
        )}
        {form.tagline && (
          <p className="mt-2 text-xs" style={{ color: theme.gradient ? 'rgba(255,255,255,0.75)' : colors.muted }}>
            {form.tagline}
          </p>
        )}
      </section>

      {/* セクション（順番・表示に従ってレンダリング） */}
      {sectionOrder
        .filter((id) => sectionVisibility[id] !== false)
        .map((id) => sectionMap[id])
        .filter(Boolean)}
    </div>
  );
}
