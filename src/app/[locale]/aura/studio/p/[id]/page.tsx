// src/app/[locale]/aura/studio/p/[id]/page.tsx
// 公開ポートフォリオページ
import { notFound } from 'next/navigation';
import { getStudioProjectByPublicId } from '@/lib/aura/studio/studioDb';
import { getTheme } from '@/lib/aura/studio/studioThemes';
import { dbRowToFormData } from '@/lib/aura/studio/studioTypes';
import { DEFAULT_SECTION_ORDER } from '@/lib/aura/studio/studioTypes';
import type { StudioFormData, WorkItem, ServiceItem, SocialLinks, SectionId } from '@/lib/aura/studio/studioTypes';
import { Globe, Twitter, Instagram } from 'lucide-react';

type Params = { id: string };

export async function generateMetadata({ params }: { params: Params }) {
  const project = await getStudioProjectByPublicId(params.id).catch(() => null);
  if (!project) return { title: 'ポートフォリオ' };
  return {
    title: `${project.name ?? 'ポートフォリオ'} | AURA Studio`,
    description: project.tagline ?? project.bio ?? '',
  };
}

export default async function StudioPublicPage({ params }: { params: Params }) {
  const project = await getStudioProjectByPublicId(params.id).catch(() => null);
  if (!project) notFound();

  const formData = { ...dbRowToFormData(project) } as StudioFormData;
  const theme = getTheme(formData.themeId);
  const { colors } = theme;
  const accent = formData.accentColor;

  const avatarUrl = formData.avatarPreviewUrl
    || (formData.avatarPath ? `/api/aura/assets?path=${encodeURIComponent(formData.avatarPath)}` : null);

  const sectionOrder: SectionId[] = formData.sectionOrder?.length ? formData.sectionOrder : DEFAULT_SECTION_ORDER;
  const sectionVisibility = formData.sectionVisibility ?? {};

  // セクション別レンダラー
  const sectionMap: Partial<Record<SectionId, React.ReactNode>> = {
    bio: formData.bio ? (
      <section key="bio">
        <SectionTitle label="About" colors={colors} />
        <p style={{ color: colors.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {formData.bio}
        </p>
      </section>
    ) : undefined,

    works: formData.works.length > 0 ? (
      <section key="works">
        <SectionTitle label="Works" colors={colors} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {formData.works.map((w: WorkItem, i: number) => (
            <div
              key={i}
              style={{
                borderRadius: theme.radius,
                overflow: 'hidden',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                boxShadow: theme.shadow,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={w.imageUrl}
                alt={w.title ?? `work-${i + 1}`}
                style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
              />
              {(w.title || w.description) && (
                <div style={{ padding: '0.5rem 0.75rem' }}>
                  {w.title && (
                    <p style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text }}>
                      {w.title}
                    </p>
                  )}
                  {w.description && (
                    <p style={{ fontSize: '0.75rem', color: colors.muted, marginTop: '0.25rem' }}>
                      {w.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    ) : undefined,

    services: formData.services.filter((s: ServiceItem) => s.name).length > 0 ? (
      <section key="services">
        <SectionTitle label="Services" colors={colors} />
        <div className="space-y-3">
          {formData.services.filter((s: ServiceItem) => s.name).map((svc: ServiceItem, i: number) => (
            <div
              key={i}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: theme.radius,
                padding: '0.875rem 1rem',
                boxShadow: theme.shadow,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: colors.text }}>{svc.name}</span>
                {svc.price && (
                  <span style={{ fontWeight: 600, color: accent, whiteSpace: 'nowrap' }}>{svc.price}</span>
                )}
              </div>
              {svc.description && (
                <p style={{ color: colors.muted, fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {svc.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    ) : undefined,

    skills: formData.skills.length > 0 ? (
      <section key="skills">
        <SectionTitle label="Skills" colors={colors} />
        <div className="flex flex-wrap gap-2">
          {formData.skills.map((skill: string) => (
            <span
              key={skill}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '999px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.85rem',
                color: colors.text,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
    ) : undefined,

    contact: (formData.social as SocialLinks).twitter
      || (formData.social as SocialLinks).instagram
      || (formData.social as SocialLinks).website ? (
      <section key="contact">
        <SectionTitle label="Contact" colors={colors} />
        <div className="flex flex-wrap gap-4">
          {(formData.social as SocialLinks).twitter && (
            <SocialLink href={(formData.social as SocialLinks).twitter!} label="X" accent={accent}>
              <Twitter className="w-4 h-4" />
            </SocialLink>
          )}
          {(formData.social as SocialLinks).instagram && (
            <SocialLink href={(formData.social as SocialLinks).instagram!} label="Instagram" accent={accent}>
              <Instagram className="w-4 h-4" />
            </SocialLink>
          )}
          {(formData.social as SocialLinks).website && (
            <SocialLink href={(formData.social as SocialLinks).website!} label="Website" accent={accent}>
              <Globe className="w-4 h-4" />
            </SocialLink>
          )}
        </div>
      </section>
    ) : undefined,
  };

  return (
    <div style={{ background: colors.bg, color: colors.text, minHeight: '100vh' }}>
      {/* Hero（常に先頭・固定） */}
      <section
        style={{
          background: theme.gradient ?? colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: '3rem 1.5rem',
          textAlign: theme.headerLayout === 'center' ? 'center' : 'left',
        }}
      >
        <div
          className="mx-auto"
          style={{
            maxWidth: 640,
            display: 'flex',
            flexDirection: 'column',
            alignItems: theme.headerLayout === 'center' ? 'center' : 'flex-start',
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={formData.name || 'avatar'}
              style={{
                width: 96, height: 96,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `4px solid ${accent}`,
                marginBottom: '1rem',
              }}
            />
          ) : (
            <div
              style={{
                width: 96, height: 96,
                borderRadius: '50%',
                background: accent,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 700,
                marginBottom: '1rem',
              }}
            >
              {(formData.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: theme.gradient ? '#fff' : colors.text, margin: 0 }}>
            {formData.name || 'No Name'}
          </h1>
          {formData.displayTitle && (
            <p style={{ color: theme.gradient ? 'rgba(255,255,255,0.85)' : accent, fontWeight: 600, marginTop: '0.5rem' }}>
              {formData.displayTitle}
            </p>
          )}
          {formData.tagline && (
            <p style={{ color: theme.gradient ? 'rgba(255,255,255,0.7)' : colors.muted, marginTop: '0.5rem', fontSize: '0.9rem' }}>
              {formData.tagline}
            </p>
          )}
        </div>
      </section>

      {/* セクション（順番・表示に従ってレンダリング） */}
      <div className="mx-auto px-6 py-8 space-y-12" style={{ maxWidth: 640 }}>
        {sectionOrder
          .filter((id) => sectionVisibility[id] !== false)
          .map((id) => sectionMap[id])
          .filter(Boolean)}

        {/* Footer */}
        <footer className="pt-4 border-t text-center" style={{ borderColor: colors.border }}>
          <p style={{ color: colors.muted, fontSize: '0.75rem' }}>
            Made with{' '}
            <a href="/aura/studio" style={{ color: accent }}>
              AURA Studio
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ label, colors }: { label: string; colors: { muted: string } }) {
  return (
    <h2
      style={{
        color: colors.muted,
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: '1rem',
      }}
    >
      {label}
    </h2>
  );
}

function SocialLink({
  href, label, accent, children,
}: {
  href: string;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: accent, display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.9rem' }}
    >
      {children}
      {label}
    </a>
  );
}
