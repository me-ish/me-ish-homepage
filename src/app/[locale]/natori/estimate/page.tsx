import type { Metadata } from "next";
import Link from "next/link";
import EstimateForm from "@/components/natori/dashboard/EstimateForm";
import Footer from "@/components/natori/Footer";

export const metadata: Metadata = {
  title: "Natori Estimate | me-ish",
  description: "ナトリ先生の制作相談向けに、依頼文から概算見積もりと返信文のたたき台を作成します。",
};

export default function NatoriEstimatePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 sm:py-3">
          <Link href="/natori" className="text-xs font-medium text-pink-600 hover:underline">
            Natori Portfolio
          </Link>
          <span className="text-xs text-gray-300">/</span>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Estimate</p>
          <p className="hidden text-sm font-bold text-gray-900 sm:inline">
            依頼文から概算見積もり
          </p>
          <div className="ml-auto">
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
        <EstimateForm />
      </section>

      <Footer />
    </main>
  );
}
