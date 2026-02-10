// app/creators/page.tsx
'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Upload,
  FileText,
  Image as Img,
  ShieldCheck,
  CreditCard,
  Timer,
  ListChecks,
  BadgeCheck,
} from 'lucide-react';

export default function CreatorsPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#222] leading-relaxed font-zen">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">出展ガイド</h1>

      {/* リード */}
      <section className="mb-8">
        <p className="text-[1.02rem]">
          me-ishは、立場や経歴に関係なく、誰でも自分らしく作品を展示できるオンラインギャラリーです。
          応募はかんたん。作品保護も運営側で対応します。
          出展時に<strong>「販売する／しない」</strong>を選べます。
        </p>
      </section>

      {/* 基本情報（4トークン） */}
      <section className="mb-10">
        <ul className="grid gap-3 sm:grid-cols-4">
          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">参加</div>
            <div className="font-extrabold tracking-tight">応募・展示無料</div>
            <div className="mt-0.5 text-xs text-[#667]">はじめてでも費用はかかりません（β）</div>
          </li>

          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">販売</div>
            <div className="font-extrabold">
              <span className="ml-1 font-semibold">手数料10%</span>
            </div>
            <div className="mt-0.5 text-xs text-[#667]">販売成立時のみ／売れなければ費用ゼロ</div>
          </li>

          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">決済</div>
            <div className="font-extrabold tracking-tight">クレジットのみ</div>
            <div className="mt-0.5 text-xs text-[#667]">暗号資産での支払いには非対応</div>
          </li>

          <li className="rounded-2xl border bg-[#f6f8fb] px-4 py-3">
            <div className="text-[11px] text-[#667]">設定</div>
            <div className="font-extrabold tracking-tight">販売する／しない</div>
            <div className="mt-0.5 text-xs text-[#667]">価格・点数も応募時に設定</div>
          </li>
        </ul>

        <p className="mt-2 text-xs text-[#667]">
          ※ アーティストへのお支払いは、売上から手数料（10%）を控除のうえ<strong>月次で銀行振込</strong>します。
          内訳・時期は <Link href="/footer/faq#fees" className="underline">FAQ</Link> をご確認ください。
        </p>
      </section>

      {/* 準備するもの */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-[#00a1e9]" />
          準備するもの
        </h2>

        <ul className="list-disc ml-5 space-y-1 text-[0.97rem]">
          <li>作品画像（<strong>推奨：長辺 3000px / JPG or PNG / sRGB</strong>）</li>
          <li>作品タイトル・説明（200〜400字目安）</li>
          <li>作者情報（SNS/ポートフォリオは任意）</li>
          <li>
            販売設定（任意）：<strong>販売する／しない</strong>、価格、点数（エディション）
          </li>
          <li>署名（サイン）（任意／ある場合はWM省略可）</li>
          <li>
            <strong>振込口座情報</strong>（売上の月次振込に使用／販売する場合は必須）
          </li>
        </ul>

        <p className="mt-2 text-xs text-[#667]">
          ※ 画像要件の詳細は <Link href="/footer/faq#assets" className="underline">FAQ: 画像ガイド</Link> を参照。
        </p>
      </section>

      {/* 出展までの流れ */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-center">出展までの流れ</h2>

        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              1
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#00a1e9]" />
                応募フォームの送信
              </p>
              <p className="text-sm text-[#555]">
                作品情報と画像を入力して送信。販売する場合は「価格」「点数（エディション）」も設定します。
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              2
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00a1e9]" />
                運営による内容確認
              </p>
              <p className="text-sm text-[#555]">
                公序良俗・権利面のチェック。
                <Timer className="inline w-3.5 h-3.5" /> 目安：1〜2営業日。
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              3
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00a1e9]" />
                画像の保護処理
              </p>
              <p className="text-sm text-[#555]">
                サイン推奨／ウォーターマーク、AI認識阻害（例：Glaze/ステガノ）等を適用します。
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              4
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Img className="w-4 h-4 text-[#00a1e9]" />
                展示・販売スタート
              </p>
              <p className="text-sm text-[#555]">
                ギャラリーに掲出。SOLD／エディション情報は自動表示。
                <span className="whitespace-nowrap">（SOLD後も表示は継続）</span>
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f2ff] text-[#0a5ea8] font-bold">
              5
            </span>
            <div>
              <p className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#00a1e9]" />
                決済・売上の還元
              </p>
              <p className="text-sm text-[#555]">
                購入者の支払いは<strong>クレジットカード（円）</strong>。
                売上は手数料（10%）を控除のうえ、規定に沿って<strong>月次で銀行振込</strong>します。
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* 取り扱いと審査 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">作品の取り扱いと審査</h2>

        <ul className="list-disc ml-5 space-y-1 text-[0.97rem]">
          <li>出展作品には、サイン推奨／ウォーターマークとAI認識阻害処理を適用します。</li>
          <li>オリジナル性、公序良俗、権利クリアを確認します。</li>
          <li>
            <strong>完全自動生成（生成AIの出力のみで、人の創作性がほぼ無い）作品は受け付けません。</strong>
            AIを使用した場合は、応募時に所定の項目で申告してください。
          </li>
          <li>展示の最適化のため、軽微なリサイズ・圧縮を行う場合があります。</li>
        </ul>

        <p className="mt-2 text-xs text-[#667]">
          詳細は <Link href="/footer/faq#policy" className="underline">出展ポリシー</Link> をご確認ください。
        </p>
      </section>

      {/* 表示保証オプションの案内（任意） */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5 text-[#00a1e9]" />
          より確実に見てもらうには
        </h2>
        <p className="text-sm text-[#555]">
          任意の<strong>表示保証オプション</strong>で、一定回数の掲出を保証できます。
          くわしくは <Link href="/modal/pricing" className="underline">プランと料金</Link> をご確認ください。
        </p>
      </section>

      {/* 応募誘導 */}
      <div className="text-center mt-14">
        <Link
          href="/entry"
          className="inline-flex items-center justify-center gap-2 bg-[#00a1e9] text-white px-6 py-3 rounded-full text-base font-semibold hover:brightness-[1.05] transition"
        >
          応募フォームへ進む <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
