import type { Metadata } from "next";
import Link from "next/link";
import ResultsBoard from "@/features/natori/components/dashboard/ResultsBoard";
import Footer from "@/features/natori/components/Footer";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Natori Results | me-ish",
  description: "ナトリの納品済み案件の件数・売上・月別推移を確認する実績ページです。",
};

export default async function NatoriResultsPage() {
  await requireNatoriAccess("/natori/results");

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50/70 via-white to-white">
      <section className="border-b border-pink-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 sm:py-3">
          <Link href="/natori/dashboard" className="text-xs font-medium text-pink-600 hover:underline">
            Dashboard
          </Link>
          <span className="text-xs text-gray-300">/</span>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Results</p>
          <p className="hidden text-sm font-bold text-gray-900 sm:inline">これまでの実績</p>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/natori/projects"
              className="inline-flex h-9 items-center justify-center rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-800 shadow-sm hover:bg-gray-50"
            >
              案件管理へ
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-4">
        <ResultsBoard />
      </section>

      <Footer />
    </main>
  );
}
