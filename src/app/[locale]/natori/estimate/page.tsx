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
      <section className="relative overflow-hidden border-b border-pink-100">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(55% 60% at 15% 15%, #ffd1e6 0%, transparent 60%), radial-gradient(65% 70% at 85% 20%, #fff0f7 0%, transparent 70%), linear-gradient(180deg, #fff7fb, #ffffff)",
          }}
        />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/natori" className="text-sm font-medium text-pink-600 hover:underline">
              Natori Portfolio
            </Link>
            <Link
              href="/natori/projects"
              className="inline-flex h-11 items-center justify-center rounded-full border border-pink-200 bg-white px-4 text-sm font-bold text-pink-700 shadow-sm shadow-pink-100/60 hover:bg-pink-50 sm:h-9"
            >
              案件管理へ
            </Link>
          </div>
          <div className="mt-5 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-pink-500">
              Estimate Helper
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight text-pink-950 sm:text-3xl md:text-5xl">
              依頼文から概算見積もりを作成
            </h1>
            <p className="mt-4 text-base leading-7 text-gray-700 md:text-lg">
              固定料金表をもとに、メニュー判定、追加料金、確認事項、返信文のたたき台をローカルで作成します。
              DB・AI API・Supabase は使いません。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 md:py-10">
        <EstimateForm />
      </section>

      <Footer />
    </main>
  );
}
