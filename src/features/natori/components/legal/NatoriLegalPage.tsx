import Link from "next/link";
import { Children, isValidElement, type ReactNode } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import PortfolioStyles from "@/features/natori/components/portfolio/PortfolioStyles";
import { portfolioFontEn, portfolioFontJp } from "@/features/natori/components/portfolio/portfolioFonts";

// 規約類（特商法・プライバシー・ご依頼規約）の共通の見た目。
// ポートフォリオと同じ「紙と文房具」（画用紙の地、手描きの枠、マーカー線、貼った紙のボタン）に合わせる。
// 内容が契約と個人情報なので、飾りは見出しと枠だけにとどめ、本文は大きめの字と広い行間で読ませる。

const legalLinks = [
  { href: "/natori/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/natori/legal/privacy", label: "プライバシーポリシー" },
  { href: "/natori/legal/terms", label: "ご依頼規約" },
] as const;

/** 目次を最初から開いておく条の数の上限。 */
const TOC_OPEN_LIMIT = 12;

type SectionHeading = { id: string | undefined; badge: string | null; label: string };

/** 「1. 取得する情報」「第1条　適用」を、番号と見出しに分ける。番号が無ければそのまま出す。 */
function parseSectionTitle(title: string): SectionHeading {
  const article = /^第(\d+)条[\s　]*(.+)$/u.exec(title);
  if (article) return { id: `article-${article[1]}`, badge: `第${article[1]}条`, label: article[2] };
  const numbered = /^(\d+)\.\s*(.+)$/u.exec(title);
  if (numbered) return { id: `section-${numbered[1]}`, badge: numbered[1], label: numbered[2] };
  return { id: undefined, badge: null, label: title };
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const heading = parseSectionTitle(title);
  return (
    <section id={heading.id} className="lg-section space-y-4">
      <h2 className="flex items-start gap-3 text-lg font-black md:text-xl">
        {heading.badge ? (
          <span
            className="mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center px-2 text-xs font-black"
            style={{
              background: c.actionSoft,
              color: c.actionTextSmall,
              borderRadius: "999px 999px 999px 6px",
            }}
          >
            {heading.badge}
          </span>
        ) : null}
        <span>{heading.label}</span>
      </h2>
      <div className="lg-body space-y-3" style={{ color: c.textSoft }}>
        {children}
      </div>
    </section>
  );
}

export function LegalDefinition({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div
      className="grid gap-1 border-b-[1.5px] border-dashed py-5 last:border-b-0 md:grid-cols-[12rem_1fr] md:gap-6"
      style={{ borderColor: c.borderSubtle }}
    >
      <dt className="lg-term font-black">{term}</dt>
      <dd className="lg-body space-y-2" style={{ color: c.textSoft }}>
        {children}
      </dd>
    </div>
  );
}

/** 子のうち LegalSection だけを拾って、目次にする。 */
function collectSectionTitles(children: ReactNode): string[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ title?: unknown }>(child) && child.type === LegalSection && typeof child.props.title === "string"
      ? [child.props.title]
      : []
  );
}

export default function NatoriLegalPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  const contents = collectSectionTitles(children)
    .map((sectionTitle) => ({ title: sectionTitle, id: parseSectionTitle(sectionTitle).id }))
    .filter((entry): entry is { title: string; id: string } => Boolean(entry.id));

  return (
    <main
      className={`pf-portfolio-root ${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} min-h-screen`}
      style={{ backgroundColor: c.page, color: c.text }}
    >
      <PortfolioStyles />
      <style>{`
        .lg-body { font-size: 1rem; line-height: 1.95; }
        .lg-term { font-size: 0.9375rem; line-height: 1.8; }
        .lg-article > .lg-section + .lg-section { border-top: 1.5px dashed ${c.borderSubtle}; padding-top: 2.25rem; }
        .lg-section { scroll-margin-top: 1.5rem; }
        .lg-body a { color: ${c.accentText}; font-weight: 700; }
        @media (max-width: 639px) { .lg-body { font-size: 1.0715rem; } .lg-term { font-size: 1rem; } }
      `}</style>
      <div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        <div className="mb-7">
          <Link
            href="/natori/portfolio"
            className="inline-flex min-h-11 items-center text-sm font-bold underline decoration-2 underline-offset-4 hover:opacity-70"
            style={{ color: c.accentText, textDecorationColor: c.accent }}
          >
            ← ナトリのあとりえに戻る
          </Link>
        </div>

        <header className="mb-7">
          <h1 className="text-2xl font-black md:text-3xl">
            <span className="pf-marker">{title}</span>
          </h1>
          {lead ? (
            <p className="lg-body mt-5" style={{ color: c.textSoft }}>
              {lead}
            </p>
          ) : null}
        </header>

        {contents.length > 0 ? (
          <nav className="pf-sketch-soft mb-7 px-4 py-2 md:px-5" aria-label="目次">
            {/* 条の数が多いページ（ご依頼規約）は、本文が遠くならないよう畳んでおく。 */}
            <details open={contents.length <= TOC_OPEN_LIMIT}>
            <summary className="cursor-pointer py-3 text-sm font-black">目次</summary>
            <ol className="mb-2 mt-1 flex flex-wrap gap-2">
              {contents.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className="inline-flex min-h-11 items-center rounded-full border-[1.5px] px-3.5 text-sm font-bold hover:opacity-70"
                    style={{ background: c.surfaceSubtle, borderColor: c.borderSubtle }}
                  >
                    {entry.title}
                  </a>
                </li>
              ))}
            </ol>
            </details>
          </nav>
        ) : null}

        <article className="lg-article pf-sketch space-y-9 px-5 py-7 md:px-8 md:py-9">
          {children}
        </article>

        <nav className="mt-9 flex flex-wrap justify-center gap-3" aria-label="法務ページ">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pf-btn pf-btn-sm inline-flex min-h-11 items-center px-4 text-sm font-bold"
              style={{ borderColor: c.ink, background: c.surface, color: c.text }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
