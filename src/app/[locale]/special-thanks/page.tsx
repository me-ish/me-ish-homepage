import type { Metadata } from "next";
import { getTranslations } from 'next-intl/server';
import SpecialThanksClient from "./special-thanks.client";

export const metadata: Metadata = {
  title: "Special Thanks | me-ish",
  description: "me-ish初期ギャラリー(white)に応募してくださった皆さま",
  alternates: { canonical: "/special-thanks" },
  openGraph: {
    title: "Special Thanks | me-ish",
    description: "me-ish初期ギャラリー(white)に応募してくださった皆さま",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Special Thanks | me-ish",
    description: "me-ish初期ギャラリー(white)に応募してくださった皆さま",
  },
};

export default async function SpecialThanksPage() {
  const t = await getTranslations('pages.specialThanks');
  return (
    <main className="min-h-[70vh] pt-[70px] px-6 py-12 bg-white">
      <div className="max-w-[1040px] mx-auto">
        {/* ゴールドグラデーション見出し */}
        <header className="mb-10 text-center">
          <h1
            className="text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent inline-flex items-center gap-2"
            id="thanks-title"
          >
            ✨ Special Thanks ✨
          </h1>
          <p className="mt-3 text-[#555] text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </header>

        <SpecialThanksClient />
      </div>
    </main>
  );
}
