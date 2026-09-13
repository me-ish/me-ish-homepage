import Link from "next/link";
import type { ReactNode } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { portfolioFontEn, portfolioFontJp } from "@/features/natori/components/portfolio/portfolioFonts";

const legalLinks = [
  { href: "/natori/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/natori/legal/privacy", label: "プライバシーポリシー" },
  { href: "/natori/legal/terms", label: "ご依頼規約" },
] as const;

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black md:text-xl">{title}</h2>
      <div className="space-y-3 text-sm leading-7" style={{ color: c.textSoft }}>
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
    <div className="grid gap-1 border-b py-4 md:grid-cols-[12rem_1fr] md:gap-6" style={{ borderColor: c.borderSubtle }}>
      <dt className="text-sm font-black">{term}</dt>
      <dd className="space-y-2 text-sm leading-7" style={{ color: c.textSoft }}>
        {children}
      </dd>
    </div>
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
  return (
    <main
      className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} min-h-screen`}
      style={{ background: c.page, color: c.text }}
    >
      <div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        <div className="mb-8">
          <Link
            href="/natori/portfolio"
            className="inline-flex min-h-11 items-center text-sm font-bold underline decoration-2 underline-offset-4 hover:opacity-70"
            style={{ color: c.accentText, textDecorationColor: c.accentSoft }}
          >
            ← Atelier Natori に戻る
          </Link>
        </div>

        <header className="mb-10">
          <p className="mb-2 text-xs font-bold tracking-[0.18em]" style={{ color: c.accentText }}>
            ATELIER NATORI
          </p>
          <h1 className="text-2xl font-black md:text-3xl">{title}</h1>
          {lead ? (
            <p className="mt-4 text-sm leading-7" style={{ color: c.textSoft }}>
              {lead}
            </p>
          ) : null}
        </header>

        <article
          className="space-y-10 rounded-2xl p-5 md:p-8"
          style={{ background: c.surface, boxShadow: `0 10px 22px ${c.shadowSoft}` }}
        >
          {children}
        </article>

        <nav className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold" aria-label="法務ページ">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="underline underline-offset-4 hover:opacity-70">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
