// src/components/aura/studio/StudioPreview.tsx
'use client';

import type { StudioFormData, SectionId } from '@/lib/aura/studio/studioTypes';
import { DEFAULT_SECTION_ORDER } from '@/lib/aura/studio/studioTypes';
import { getTheme } from '@/lib/aura/studio/studioThemes';
import { getFontPreset, getAvatarBorderRadius, getBgPatternStyle } from '@/lib/aura/studio/designPresets';
import type { AvatarShape, BgPattern } from '@/lib/aura/studio/designPresets';
import { Globe, Instagram } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';

type Props = {
  form: StudioFormData;
};

export default function StudioPreview({ form }: Props) {
  const theme = getTheme(form.themeId);
  const { colors } = theme;
  const accent = form.accentColor;
  const fontPreset = getFontPreset(form.fontPreset);
  const headerLayout = (form.layoutPref as import('@/lib/aura/studio/designPresets').LayoutPref) || theme.headerLayout;
  const avatarBorderRadius = getAvatarBorderRadius((form.avatarShape || 'circle') as AvatarShape);
  const bgPatternStyle = getBgPatternStyle((form.bgPattern || 'none') as BgPattern, colors.border);

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
              <FaXTwitter className="w-3 h-3" /> X
            </a>
          )}
          {form.social.instagram && (
            <a
              href={form.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs"
              style={{ color: accent }}
            >
              <Instagram className="w-3 h-3" /> Instagram
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

  const isBanner     = headerLayout === 'banner';
  const isSideLeft   = headerLayout === 'side-left';
  const isSideRight  = headerLayout === 'side-right';
  const isHorizontal = isSideLeft || isSideRight;

  // アバター要素（レイアウトに依存しない共通部分）
  const AVATAR_SIZE = 72;
  const avatarEl = form.avatarPreviewUrl || form.avatarPath ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={form.avatarPreviewUrl || `/api/aura/assets?path=${encodeURIComponent(form.avatarPath)}`}
      alt="avatar"
      style={{
        width: AVATAR_SIZE, height: AVATAR_SIZE,
        borderRadius: avatarBorderRadius,
        objectFit: 'cover',
        border: `3px solid ${accent}`,
        flexShrink: 0,
        display: 'block',
      }}
    />
  ) : (
    <div
      style={{
        width: AVATAR_SIZE, height: AVATAR_SIZE,
        borderRadius: avatarBorderRadius,
        background: accent,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {(form.name || '?').charAt(0).toUpperCase()}
    </div>
  );

  // テキスト要素
  const textEl = (
    <>
      <h1 className="font-bold text-xl leading-tight" style={{ color: theme.gradient ? '#fff' : colors.text }}>
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
    </>
  );

  const heroBg: React.CSSProperties = {
    background: theme.gradient ?? colors.surface,
    borderBottom: `1px solid ${colors.border}`,
  };

  return (
    <div
      className="h-full overflow-y-auto text-sm"
      style={{ background: colors.bg, color: colors.text, fontFamily: fontPreset.fontFamily, ...bgPatternStyle }}
    >
      {/* Google Fonts 動的ロード */}
      {fontPreset.googleFontUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <style dangerouslySetInnerHTML={{ __html: `@import url('${fontPreset.googleFontUrl}');` }} />
      )}

      {/* Hero（常に先頭・固定） */}
      {isBanner ? (
        /* バナー: テキスト中央・アバターが下端からはみ出す */
        <section
          style={{
            ...heroBg,
            padding: `1.5rem 1.5rem ${AVATAR_SIZE / 2 + 16}px`,
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {textEl}
          <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%, 50%)', zIndex: 10 }}>
            {avatarEl}
          </div>
        </section>
      ) : isHorizontal ? (
        /* 横並び */
        <section style={{ ...heroBg, padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: isSideRight ? 'row-reverse' : 'row', alignItems: 'center', gap: '1rem' }}>
            {avatarEl}
            <div>{textEl}</div>
          </div>
        </section>
      ) : (
        /* 縦積み（center / left / テーマデフォルト） */
        <section
          className="px-6 py-8"
          style={{
            ...heroBg,
            textAlign: headerLayout === 'center' ? 'center' : 'left',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.25rem',
            alignItems: headerLayout === 'center' ? 'center' : 'flex-start',
          }}>
            <div style={{ marginBottom: '0.75rem' }}>{avatarEl}</div>
            {textEl}
          </div>
        </section>
      )}

      {/* セクション（順番・表示に従ってレンダリング） */}
      <div style={{ paddingTop: isBanner ? AVATAR_SIZE / 2 + 8 : 0 }}>
        {sectionOrder
          .filter((id) => sectionVisibility[id] !== false)
          .map((id) => sectionMap[id])
          .filter(Boolean)}
      </div>
    </div>
  );
}
