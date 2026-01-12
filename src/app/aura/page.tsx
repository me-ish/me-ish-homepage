// src/app/aura/page.tsx
"use client";

import Link from "next/link";
import {
  Sparkles,
  Wand2,
  Palette,
  FileText,
  Globe,
  Ticket,
  BadgeCheck,
  ArrowRight,
  Check,
  Info,
} from "lucide-react";

export default function AuraPage() {
  return (
    <main className="px-6 py-16 mx-auto max-w-3xl text-[#222] leading-relaxed font-zen">
      {/* Hero */}
      <header className="text-center mb-12">
        <p className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-[11px] text-[#334]">
          <Sparkles className="w-4 h-4 text-[#00a1e9]" />
          me-ish AURA（ポートフォリオ）
        </p>
<h1 className="mt-4 mb-3 font-zen leading-[1.05] tracking-tight">
  {/* 上段：強い主語（太め＆大きめ） */}
  <span
    className="
      block text-[clamp(2.1rem,4.6vw,3.2rem)] font-extrabold
      text-transparent bg-clip-text
      bg-[linear-gradient(90deg,#00a1e9,rgba(0,161,233,0.55))]
      drop-shadow-[0_10px_22px_rgba(0,161,233,0.16)]
    "
  >
    仕事につながる
  </span>

  {/* 下段：結論（最短で）を際立てる。スマホは改行維持 */}
<span className="mt-1 block text-[clamp(1.9rem,4.2vw,3rem)] font-extrabold text-[#00a1e9]">
  <span className="inline-flex items-baseline">
    ポートフォリオを
    <span className="sm:hidden"><br /></span>
    <span
      className="
        inline-block ml-1 align-baseline
        px-1
        bg-[linear-gradient(transparent_62%,rgba(0,161,233,0.18)_62%)]
        rounded-[999px]
      "
    >
      最短で
    </span>
  </span>
</span>

</h1>



<p className="text-[1.02rem] text-[#334]">
  世界観（見た目）と文章（伝わり方）を整えて、<strong>依頼につながる見せ方</strong>に仕上げます。<br />
  <strong>作成したページはあなたの営業資産として“そのまま自分のもの”</strong>になります（公開URLを発行）。
</p>


        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/aura/form"
            className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
            aria-label="AURAでポートフォリオを作成する"
          >
            今すぐ作成する <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#00a1e9] px-6 py-3 text-[#00a1e9] font-semibold hover:bg-[#e8f7ff] transition"
            aria-label="料金と無料条件へ"
          >
            料金と無料条件 <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <p className="mt-3 text-xs text-[#667]">
          先行無料券（先着20名）・me-ish展示採用者は1回無料。
        </p>
      </header>

      {/* What it does */}
      <section aria-labelledby="features" className="mb-12">
        <h2 id="features" className="text-xl font-bold mb-3">
          AURAでできること
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard
            icon={<Palette className="w-5 h-5 text-[#00a1e9]" />}
            title="世界観を整える"
            body="背景・フォント・質感のテンプレをベースに、あなたの雰囲気に合わせて“見せ方”を統一します。"
          />
          <FeatureCard
            icon={<FileText className="w-5 h-5 text-[#00a1e9]" />}
            title="文章を整える"
            body="自己紹介・サービス説明などを、読みやすく・伝わりやすく整形します（仕上がり調整）。"
          />
          <FeatureCard
            icon={<Globe className="w-5 h-5 text-[#00a1e9]" />}
            title="公開URLができる"
            body="完成したポートフォリオは公開ページとして残り、SNS・名刺・営業DMでそのまま使えます。あなたの実績と一緒に育つ“営業資産”になります。"
          />
          <FeatureCard
            icon={<Wand2 className="w-5 h-5 text-[#00a1e9]" />}
            title="“揺らぎ”を調整できる"
            body="調整度スライダーで、テンプレ感を抑えつつ“自分らしさ”を出す方向に寄せられます。"
          />
        </div>
      </section>

      {/* Steps */}
      <section aria-labelledby="steps" className="mb-12">
        <h2 id="steps" className="text-xl font-bold mb-3">
          作成の流れ（3ステップ）
        </h2>

        <ol className="space-y-3">
          <StepItem
            num="1"
            title="作品とプロフィールを入力"
            body="作品画像・名前・肩書き・自己紹介・サービス内容など、最低限を入れます。"
          />
          <StepItem
            num="2"
            title="世界観を選ぶ（仕上がり調整）"
            body="ベースの世界観テンプレを選び、揺らぎ（AI強度）で“あなた寄り”に調整します。"
          />
          <StepItem
            num="3"
            title="生成 → プレビュー → 公開"
            body="プレビューで確認して、完成したら公開URLが生成されます（＝本公開扱い）。"
          />
        </ol>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title" className="mb-12">
        <h2 id="pricing-title" className="text-xl font-bold mb-3">
          料金と無料条件
        </h2>

        <div className="rounded-2xl border bg-[#f6f8fb] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-[#00a1e9]" />
                <h3 className="text-lg font-semibold">買い切り</h3>
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight">¥700</div>
              <ul className="mt-3 space-y-2 text-sm">
                <LI>
                  <strong>作成したページはあなたのもの（公開URL発行）</strong>
                </LI>
                <LI>まずは“作る”体験を低価格で</LI>
                <LI muted>※今後の機能追加で価値は上がりますが、当面は価格固定で運用</LI>
              </ul>
              <div className="mt-4">
                <Link
                  href="/aura/form"
                  className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:brightness-[1.05] transition"
                >
                  作成する <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </article>

            <article className="rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#00a1e9]" />
                <h3 className="text-lg font-semibold">無料条件</h3>
              </div>

              <ul className="mt-3 space-y-2 text-sm">
                <LI>
                  <strong>先行無料券：先着20名</strong>
                </LI>
                <LI>
                  <strong>me-ish 展示採用者：1回無料</strong>
                </LI>
                <LI muted>
                  ※無料枠は予告なく終了する場合があります（先着順で判定）。
                </LI>
              </ul>

              <div className="mt-4 rounded-xl border bg-[#f6f8fb] px-4 py-3 text-[12px] text-[#556]">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-[#00a1e9]" />
                  <p>
                    無料枠の運用ロジック（クーポン/自動判定など）は段階的に整備します。
                    まずはこの条件で運用開始します。
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="mb-14">
        <h2 id="faq-title" className="text-xl font-bold mb-3">
          よくある質問
        </h2>

        <div className="space-y-3">
          <FaqItem
            q="無料枠（先着20名）はどう判定されますか？"
            a="作成申し込みの先着順です。枠が埋まり次第終了します。"
          />
          <FaqItem
            q="作ったあと、編集できますか？"
            a="現時点では、入力内容の再生成・調整を中心に整備中です。運用しながら改善します。"
          />
          <FaqItem
            q="作成完了＝本公開という扱い？"
            a="はい。作成が完了した時点で公開URLが生成されるため、仮公開/本公開を分けずに運用します。"
          />
          <FaqItem
            q="me-ish展示採用者の無料はどう受け取りますか？"
            a="採用通知メールなどで案内します。"
          />
          <FaqItem
            q="me-ishギャラリーとどう繋がりますか？"
            a="ギャラリーで実績（展示）を作り、AURAで営業に使える形へ整える導線として設計しています。"
          />
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/aura/form"
          className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
        >
          AURAでポートフォリオを作成する <ArrowRight className="w-4 h-4" />
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link href="/white" className="underline text-[#0a5ea8] hover:opacity-80">
            White Galleryを見る
          </Link>
          <span className="text-[#99a]">/</span>
          <Link href="/float" className="underline text-[#0a5ea8] hover:opacity-80">
            Float Galleryを見る
          </Link>
        </div>

        <p className="text-xs text-[#667] mt-3">
          まずは「作る」を最短で。公開URLを営業導線に使えます。
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
      <Check className={`w-4 h-4 mt-0.5 ${muted ? "text-[#9aa]" : "text-[#00a1e9]"}`} />
      <span>{children}</span>
    </li>
  );
}
