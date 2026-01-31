// src/app/footer/disclaimer/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "免責事項 | me-ish",
  description:
    "me-ish の免責事項。情報の正確性、サービス中断、第三者行為、出展作品の表示・管理、責任制限、問い合わせ窓口などを定めます。",
};

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* ヘッダ */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">免責事項</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          me-ish（以下「当サービス」）の利用にあたり、以下の事項をご理解・ご同意のうえご利用ください。
          本ページは{" "}
          <Link href="/footer/terms#sec-10" className="underline underline-offset-2">
            利用規約 第10条（免責事項・責任制限）
          </Link>{" "}
          を補足するものです。
        </p>
      </header>

      {/* 本文 */}
      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2 id="sec-1" className="scroll-mt-28">
          <strong>第1条（情報の正確性）</strong>
        </h2>
        <p>
          当サービスは、掲載情報の正確性・完全性・有用性の確保に努めますが、これらを保証するものではありません。
          誤りが判明した場合は、合理的な範囲で訂正・更新を行います。
        </p>

        <h2 id="sec-2" className="scroll-mt-28">
          <strong>第2条（サービスの中断・停止）</strong>
        </h2>
        <p>
          当サービスは、次の場合に、事前の通知なくサービスの一部または全部を中断または停止することがあります。
        </p>
        <ul>
          <li>システム保守、機能追加・変更、セキュリティ対応の必要があるとき</li>
          <li>サーバ障害、ネットワーク障害、外部サービスの停止が発生したとき</li>
          <li>地震・停電・災害その他の不可抗力が生じたとき</li>
        </ul>
        <p>
          中断・停止により利用者に損害が生じた場合の取扱いは、下記「第6条（責任の範囲）」および
          <Link href="/footer/terms#sec-10" className="underline underline-offset-2">
            利用規約 第10条
          </Link>{" "}
          の定めに従います。
        </p>

        <h2 id="sec-3" className="scroll-mt-28">
          <strong>第3条（出展作品の表示・管理）</strong>
        </h2>
        <p>
          出展作品の表示・販売は、システム負荷、閲覧環境、外部サービス、第三者の不正等の影響を受ける場合があります。
          表示順・露出量・販売状況等は一定であることを保証しません（{" "}
          <Link href="/footer/terms#sec-6" className="underline underline-offset-2">
            利用規約 第6条
          </Link>{" "}
          参照）。
        </p>

        <h2 id="sec-4" className="scroll-mt-28">
          <strong>第4条（第三者による行為）</strong>
        </h2>
        <p>
          当サービス外部での第三者の行為（無断転載、スクリーンショット、二次配布、権利侵害、悪質なアクセス等）に起因して
          利用者またはアーティストに損害が生じた場合、当サービスは、当該第三者による行為について合理的範囲を超える責任を負いません。
          ただし、当サービスが把握可能な範囲で、通報受付、削除申請等の支援、必要に応じたアクセス制限等の対応を行う場合があります（{" "}
          <Link href="/footer/copyright#sec-7" className="underline underline-offset-2">
            著作権・AI学習防止ポリシー 第7条
          </Link>{" "}
          参照）。
        </p>

        <h2 id="sec-5" className="scroll-mt-28">
          <strong>第5条（責任の範囲）</strong>
        </h2>
        <p>
          当サービスは、<strong>故意または重過失</strong>がある場合を除き、当サービスの債務不履行または不法行為により
          利用者に生じた<strong>直接かつ通常の損害</strong>の範囲で、<strong>過去12か月間に利用者が当サービスに実際に支払った対価総額</strong>
          を上限として賠償責任を負います。生命・身体の侵害、知的財産権侵害、個人情報保護法違反については本上限を適用しません（{" "}
          <Link href="/footer/terms#sec-10" className="underline underline-offset-2">
            利用規約 第10条
          </Link>{" "}
          参照）。
        </p>

        <h2 id="sec-6" className="scroll-mt-28">
          <strong>第6条（規約との関係）</strong>
        </h2>
        <p>
          本免責事項は{" "}
          <Link href="/footer/terms" className="underline underline-offset-2">
            利用規約
          </Link>{" "}
          の一部を構成します。本免責事項と利用規約の内容が矛盾または抵触する場合は、利用規約の定めが優先して適用されます。
        </p>

        <h2 id="sec-7" className="scroll-mt-28">
          <strong>第7条（お問い合わせ）</strong>
        </h2>
        <p>
          本免責事項に関するお問い合わせは、{" "}
          <Link href="/contact" className="underline underline-offset-2">
            お問い合わせフォーム
          </Link>{" "}
          または <span>info [at] me-ish.art</span> までご連絡ください（送信時は「[at]」を「@」に置換してください）。
        </p>

        <p>
          <time dateTime="2025-08-18">制定日：2025年8月18日</time>
          <br />
          <time dateTime="2026-01-17">改定日：2026年1月17日</time>
        </p>
      </article>
    </main>
  );
}
