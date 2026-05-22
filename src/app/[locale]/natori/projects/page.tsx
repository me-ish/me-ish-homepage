import type { Metadata } from "next";
import Link from "next/link";
import ProjectsBoard from "@/components/natori/dashboard/ProjectsBoard";
import Footer from "@/components/natori/Footer";

export const metadata: Metadata = {
  title: "Natori Projects | me-ish",
  description: "ナトリ先生の制作案件を軽く確認するための、スマホ向け案件一覧ページです。",
};

export default function NatoriProjectsPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/natori" className="text-sm font-medium text-pink-600 hover:underline">
              Natori Portfolio
            </Link>
            <Link
              href="/natori/estimate"
              className="inline-flex h-11 items-center justify-center rounded-full border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50 sm:h-9"
            >
              見積もりへ
            </Link>
          </div>
          <div className="mt-5 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-600">Projects</p>
            <h1 className="mt-3 text-2xl font-black leading-tight text-gray-900 sm:text-3xl md:text-5xl">
              今日やることがすぐ分かる案件一覧
            </h1>
            <p className="mt-4 text-base leading-7 text-gray-700 md:text-lg">
              進行中の案件と次の作業だけを軽く確認するページです。今は mock data と画面内 state のみで動きます。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 md:py-10">
        <ProjectsBoard />
      </section>

      <Footer />
    </main>
  );
}
