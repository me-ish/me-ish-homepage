import type { Metadata } from "next";
import Link from "next/link";
import ProjectsBoard from "@/components/natori/dashboard/ProjectsBoard";
import Footer from "@/components/natori/Footer";
import { requireNatoriAdmin } from "@/lib/natori/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Natori Projects | me-ish",
  description: "ナトリ先生の制作案件を軽く確認するための、スマホ向け案件一覧ページです。",
};

export default async function NatoriProjectsPage() {
  await requireNatoriAdmin("/natori/projects");

  return (
    <main className="min-h-screen bg-white">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 sm:py-3">
          <Link href="/natori/dashboard" className="text-xs font-medium text-pink-600 hover:underline">
            Dashboard
          </Link>
          <span className="text-xs text-gray-300">/</span>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Projects</p>
          <p className="hidden text-sm font-bold text-gray-900 sm:inline">案件カレンダー</p>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/natori/estimate"
              className="inline-flex h-9 items-center justify-center rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-800 shadow-sm hover:bg-gray-50"
            >
              見積もりへ
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-4">
        <ProjectsBoard />
      </section>

      <Footer />
    </main>
  );
}
