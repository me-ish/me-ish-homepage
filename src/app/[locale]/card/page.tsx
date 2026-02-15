// src/app/[locale]/card/page.tsx
"use client";

import Link from "next/link";
import {
  CreditCard,
  Palette,
  QrCode,
  FileDown,
  ArrowRight,
  Check,
  Smartphone,
} from "lucide-react";

export default function CardLandingPage() {
  return (
    <main className="px-6 py-16 mx-auto max-w-3xl text-[#222] leading-relaxed font-zen">
      {/* Hero */}
      <header className="text-center mb-12">
        <p className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-[11px] text-[#334]">
          <CreditCard className="w-4 h-4 text-[#00a1e9]" />
          me-ish CARD
        </p>
        <h1 className="mt-4 mb-3 font-zen leading-[1.05] tracking-tight">
          <span
            className="
              block text-[clamp(2.1rem,4.6vw,3.2rem)] font-extrabold
              text-transparent bg-clip-text
              bg-[linear-gradient(90deg,#00a1e9,rgba(0,161,233,0.55))]
              drop-shadow-[0_10px_22px_rgba(0,161,233,0.16)]
            "
          >
            アーティストのための
          </span>
          <span className="mt-1 block text-[clamp(1.9rem,4.2vw,3rem)] font-extrabold text-[#00a1e9]">
            <span className="inline-flex items-baseline">
              AIデザイン
              <span className="sm:hidden">
                <br />
              </span>
              <span
                className="
                  inline-block ml-1 align-baseline px-1
                  bg-[linear-gradient(transparent_62%,rgba(0,161,233,0.18)_62%)]
                  rounded-[999px]
                "
              >
                デジタル名刺
              </span>
            </span>
          </span>
        </h1>

        <p className="text-[1.02rem] text-[#334]">
          3ステップで完成する、あなたの世界観を表現したデジタル名刺。
          <br />
          <strong>QRコードで共有、PDFで印刷</strong>
          もできます。
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/card/form"
            className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
          >
            無料で作成する <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00a1e9] px-6 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
          >
            機能を見る <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <p className="mt-3 text-xs text-[#667]">
          全機能無料。3ステップで完成。
        </p>
      </header>

      {/* Features */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-3">me-ish CARDの特徴</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard
            icon={<Palette className="w-5 h-5 text-[#00a1e9]" />}
            title="10種類の世界観"
            body="Minimal, Modern, Cyber, Luxury... あなたの作風に合った世界観を選ぶだけ。"
          />
          <FeatureCard
            icon={<Smartphone className="w-5 h-5 text-[#00a1e9]" />}
            title="レスポンシブ対応"
            body="スマホ・タブレット・PCすべてで美しく表示。対面でもオンラインでも使えます。"
          />
          <FeatureCard
            icon={<QrCode className="w-5 h-5 text-[#00a1e9]" />}
            title="QRコード内蔵"
            body="名刺にQRコードを自動生成。スマホで読み取るだけであなたのカードにアクセス。"
          />
          <FeatureCard
            icon={<FileDown className="w-5 h-5 text-[#00a1e9]" />}
            title="PDF出力対応"
            body="名刺サイズ（91mm×55mm）のPDFをダウンロード。印刷してリアル名刺にも。"
          />
        </div>
      </section>

      {/* Steps */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-3">
          3ステップで完成
        </h2>
        <ol className="space-y-3">
          <StepItem
            num="1"
            title="プロフィールを入力"
            body="名前・肩書き・SNSリンク・アバター画像を入力します。"
          />
          <StepItem
            num="2"
            title="作品をアップロード"
            body="あなたの代表作を最大6点までアップロード。"
          />
          <StepItem
            num="3"
            title="世界観を選んで完成"
            body="10種類のデザインテーマから選択。AI強度で微調整して、すぐに公開URLが発行されます。"
          />
        </ol>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mb-12">
        <h2 className="text-xl font-bold mb-3">料金</h2>
        <div className="rounded-2xl border bg-[#f6f8fb] p-5">
          <article className="rounded-2xl border-2 border-[#00a1e9] bg-white p-5 max-w-md mx-auto relative">
            <div className="absolute -top-3 right-4 bg-[#00a1e9] text-white text-xs font-bold px-3 py-1 rounded-full">
              全機能無料
            </div>
            <h3 className="text-lg font-semibold">me-ish CARD</h3>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-[#00a1e9]">
              ¥0
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <LI>作品 最大6点</LI>
              <LI>10種類のデザインテーマ</LI>
              <LI>パララックス + フェードインアニメーション</LI>
              <LI>QRコード生成</LI>
              <LI>名刺PDF出力</LI>
              <LI>カスタムURL</LI>
              <LI>公開URL発行</LI>
            </ul>
            <div className="mt-4">
              <Link
                href="/card/form"
                className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:brightness-[1.05] transition"
              >
                無料で作成する <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-14">
        <h2 className="text-xl font-bold mb-3">よくある質問</h2>
        <div className="space-y-3">
          <FaqItem
            q="ずっと無料で使えますか？"
            a="はい。作成したカードは無期限で公開されます。"
          />
          <FaqItem
            q="作成後に編集できますか？"
            a="プレビュー画面で内容を確認してから公開します。今後、公開後の編集機能も追加予定です。"
          />
          <FaqItem
            q="PDFは何に使えますか？"
            a="名刺サイズ（91mm×55mm）のPDFが生成されるので、印刷して実際の名刺として配布できます。"
          />
          <FaqItem
            q="me-ish AURAとの違いは？"
            a="AURAは本格的なポートフォリオページ、CARDは名刺に特化した簡易版です。用途に合わせてお使いください。"
          />
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/card/form"
          className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
        >
          デジタル名刺を作成する <ArrowRight className="w-4 h-4" />
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="/aura"
            className="underline text-[#0a5ea8] hover:opacity-80"
          >
            AURA（ポートフォリオ）を見る
          </Link>
        </div>
        <p className="text-xs text-[#667] mt-3">
          3ステップ・最短1分で完成。あなたの世界観を名刺に。
        </p>
      </div>
    </main>
  );
}

/* ---------- Sub Components ---------- */

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-[#445] leading-relaxed">{body}</p>
    </article>
  );
}

function StepItem({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-2xl border bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f4ff] text-[#0a5ea8] font-bold">
          {num}
        </span>
        <div>
          <div className="font-semibold">{title}</div>
          <p className="mt-1 text-sm text-[#445] leading-relaxed">{body}</p>
        </div>
      </div>
    </li>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="font-semibold">{q}</div>
      <p className="mt-2 text-sm text-[#445] leading-relaxed">{a}</p>
    </div>
  );
}

function LI({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li className={`flex items-start gap-2 ${muted ? "text-[#667]" : ""}`}>
      <Check
        className={`w-4 h-4 mt-0.5 ${muted ? "text-[#9aa]" : "text-[#00a1e9]"}`}
      />
      <span>{children}</span>
    </li>
  );
}
