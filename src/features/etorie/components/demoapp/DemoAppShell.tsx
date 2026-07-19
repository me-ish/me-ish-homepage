// features/etorie/components/demoapp/DemoAppShell.tsx
// /etorie/demo/app 配下（さわれるデモ環境）の共通シェル。
// 上部にデモ環境バナーを出し、管理画面系ページには natori 実ページと同じ
// 見た目のヘッダー（パンくず + タイトル）を付ける。
// 公開ページ系（ポートフォリオ等）は bare で包み、バナーだけ付ける。
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

function DemoBanner() {
  return (
    <div className="border-b border-[#E5DED4] bg-[#FAF7F2]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs sm:px-6">
        <span className="inline-flex items-center gap-1.5 font-bold text-[#A87F3C]">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          エトリエ デモ環境
        </span>
        <span className="text-[#6E6879]">
          架空のクリエイター「ユキノ」のサンプルデータです。自由に触れます（保存・送信・画像アップロードは動きません）
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <Link href="/etorie/demo" className="font-bold text-[#C43A6E] hover:underline">
            使い方の流れ
          </Link>
          <Link href="/etorie" className="font-bold text-[#C43A6E] hover:underline">
            紹介ページ
          </Link>
        </span>
      </div>
    </div>
  );
}

type DemoAppShellProps = {
  children: ReactNode;
  /** 管理画面ヘッダーの英字ラベル（例: INQUIRIES）。bare のときは不要 */
  crumb?: string;
  /** 管理画面ヘッダーのタイトル（例: 問い合わせ管理） */
  title?: string;
  /** ページ本体が独自の <main> を持つ場合はバナーだけ付ける */
  bare?: boolean;
};

export default function DemoAppShell({ children, crumb, title, bare }: DemoAppShellProps) {
  if (bare) {
    return (
      <div>
        <DemoBanner />
        {children}
      </div>
    );
  }
  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50/70 via-white to-white">
      <DemoBanner />
      <section className="border-b border-pink-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href="/etorie/demo/app"
            className="inline-flex items-center gap-1 text-xs font-bold text-pink-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>
          {crumb ? (
            <>
              <span className="text-xs text-gray-400">/</span>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-600">{crumb}</p>
            </>
          ) : null}
          {title ? <p className="text-sm font-bold text-gray-900">{title}</p> : null}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">{children}</section>
    </main>
  );
}
