import type { Metadata } from "next";
import Link from "next/link";
import InquiriesBoard from "@/features/natori/components/dashboard/InquiriesBoard";
import Footer from "@/features/natori/components/Footer";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Natori Inquiries | me-ish",
  description:
    "ご依頼フォームから届いた問い合わせの内容確認・見積もり/支払いメール送信・進捗管理を行うページです。",
};

export default async function NatoriInquiriesPage() {
  await requireNatoriAccess("/natori/inquiries");

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50/70 via-white to-white">
      <section className="border-b border-pink-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 sm:py-3">
          <Link href="/natori/dashboard" className="text-xs font-medium text-pink-600 hover:underline">
            Dashboard
          </Link>
          <span className="text-xs text-gray-300">/</span>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">Inquiries</p>
          <p className="hidden text-sm font-bold text-gray-900 sm:inline">問い合わせ管理</p>
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
        <InquiriesBoard />
      </section>

      <Footer />
    </main>
  );
}
