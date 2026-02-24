// app/footer/privacy/page.tsx
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

// shadcn/ui
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const POLICY_ENACTED_AT = "2025年8月18日";
const POLICY_REVISED_AT = "2026年1月17日"; // ★運用：更新時に“最終改定日”として置き換え推奨

const tocItems = [
  ['取得する情報', 'sec-1'],
  ['利用目的', 'sec-2'],
  ['第三者提供の制限', 'sec-3'],
  ['委託（処理者への提供）', 'sec-4'],
  ['国外移転', 'sec-5'],
  ['Cookie・解析・広告', 'sec-6'],
  ['安全管理・保有期間', 'sec-7'],
  ['開示・訂正・削除等の請求', 'sec-8'],
  ['未成年の利用', 'sec-9'],
  ['改定・適用日', 'sec-10'],
  ['お問い合わせ', 'sec-11'],
] as const;

export default function PrivacyPage() {
  const locale = useLocale();
  const t = useTranslations();

  if (locale === 'en') {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-6">
        <p className="text-gray-500 text-center max-w-md">{t('jaOnly')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* ヘッダ */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">プライバシーポリシー</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          me-ish（以下「当サービス」）は、利用者のプライバシーを尊重し、
          個人情報の適切な保護と管理を行います。本ポリシーは、当サービスにおける個人情報等の取扱いについて定めるものです。
        </p>
      </header>

      {/* 目次（SP: 折りたたみ / PC: 追従カード） */}
      <aside
        className={[
          "mb-8 rounded-2xl border bg-gray-50 p-4",
          "md:float-right md:ml-8 md:w-72",
          "md:sticky md:top-6",
        ].join(" ")}
        aria-label="目次"
      >
        <Accordion type="single" collapsible>
          <AccordionItem value="toc" className="border-none">
            <AccordionTrigger className="py-1 text-sm font-semibold text-gray-900 hover:no-underline">
              目次
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <nav className="grid gap-1">
                {tocItems.map(([label, id]) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="rounded-md px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00a1e9]"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>

      {/* 本文 */}
      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2 id="sec-1"><strong>第1条（取得する情報）</strong></h2>
        <p>当サービスでは、以下の情報を取得する場合があります。</p>
        <ul>
          <li>氏名（本名またはペンネーム）等のプロフィール情報</li>
          <li>メールアドレス等の連絡先、アカウント識別子（外部ID連携を含む）</li>
          <li>作品に関する情報（画像・ファイル・テキスト等）、出展・購入履歴</li>
          <li>決済関連情報（Stripe を通じて取得・保持。カード番号等のセンシティブ情報は当サービスで保有しません）</li>
          <li>IPアドレス、ブラウザ・OS、デバイス情報、リファラ、アクセス日時、行動ログ等</li>
          <li>お問い合わせ内容、アンケート回答、キャンペーン応募情報 ほか</li>
        </ul>

        <h2 id="sec-2"><strong>第2条（利用目的）</strong></h2>
        <p>取得した情報は、以下の目的で利用します。</p>
        <ul>
          <li>応募作品の確認・審査、展示・販売等の提供、本人確認</li>
          <li>購入・決済・デジタル引渡・カスタマーサポート対応</li>
          <li>アーティストへの連絡および売上の精算（振込）</li>
          <li>不正・違反行為の防止、セキュリティ対策、障害対応、品質改善、統計分析</li>
          <li>新機能・キャンペーン等の案内（<strong>事前同意がある場合</strong>のメール配信を含む）</li>
          <li>法令・規約に基づく権利行使・義務履行</li>
        </ul>

        <h2 id="sec-3"><strong>第3条（第三者提供の制限）</strong></h2>
        <p>
          当サービスは、次のいずれかに該当する場合を除き、本人の同意なく個人データを第三者に提供しません。
        </p>
        <ul>
          <li>法令に基づく場合、人の生命・身体・財産の保護に必要な場合で同意取得が困難なとき</li>
          <li>合併等の事業承継に伴う提供</li>
          <li>あらかじめ個別に同意を得た場合</li>
        </ul>
        <p className="text-sm text-gray-600">
          ※ 次条の「委託」は、個人情報保護法上の第三者提供には当たりません（当サービス運営者の監督下で処理されるため）。
        </p>

        <h2 id="sec-4"><strong>第4条（委託：処理者への提供）</strong></h2>
        <p>当サービスは、業務遂行のため、以下の事業者に処理を委託する場合があります。</p>
        <ul>
          <li>Stripe：課金・決済処理（クレジットカード等）。カード情報は Stripe が保持します。</li>
          <li>Supabase：データベース・認証等の管理</li>
          <li>Google Workspace：運営側のメール・文書管理</li>
          <li>その他、分析・配信・保守運用のためのクラウドサービス</li>
        </ul>
        <p className="text-sm text-gray-600">
          当サービスは、委託先の選定にあたり安全管理措置を確認し、機密保持・再委託制限・漏えい等発生時の通知義務を契約等で義務付け、
          <strong>適切な監督</strong>を行います。
        </p>

        <h2 id="sec-5"><strong>第5条（国外移転）</strong></h2>
        <p>
          決済・クラウド提供等のため、<strong>国外にある委託先</strong>に個人データを提供・保管する場合があります。
          当サービスは、外国における個人情報保護制度や受領者の体制等の情報を把握し、契約・規程により適切な措置を講じたうえで提供します。
          国外の第三者への提供（委託に該当しない提供）を行う場合は、<strong>本人に必要な情報を提供して同意を取得</strong>します。
        </p>
        <p className="text-sm text-gray-600">
          主要な移転先事業者（例：Stripe, Supabase, Google）は海外拠点を含み得ます。詳細は各社のプライバシーポリシーもご参照ください。
        </p>

        <h2 id="sec-6"><strong>第6条（Cookie・解析・広告）</strong></h2>
        <p>
          当サービスは、利便性向上・セキュリティ対策・統計分析・不正防止のため Cookie 等を使用する場合があります。
          ブラウザ設定で Cookie を無効化できますが、一部機能が利用できない場合があります。
        </p>
        <ul>
          <li>解析：当社（当サービス運営者）または委託先の解析機能により、閲覧・操作ログを収集・集計する場合があります。</li>
          <li>広告：現時点で行動ターゲティング広告は行っていません。将来実施する場合は事前に告知し、必要な同意管理を実装します。</li>
        </ul>

        <h2 id="sec-7"><strong>第7条（安全管理・保有期間）</strong></h2>
        <ul>
          <li>技術的/組織的安全管理措置（アクセス制御、TLS暗号化通信、データベース暗号化、ログ監査、権限管理等）を講じます。</li>
          <li>
            個人データの保有期間は、利用目的の達成に必要な最小限の期間とし、不要となった情報は安全な方法で消去します。
            保有期間の目安は以下のとおりです。
            <ul className="mt-2 ml-4">
              <li>取引記録（購入・販売履歴）：取引完了後<strong>7年間</strong>（法令上の保存義務に準拠）</li>
              <li>アカウント情報：退会後<strong>1年間</strong>（不正利用防止のため）</li>
              <li>お問い合わせ履歴：対応完了後<strong>3年間</strong></li>
              <li>アクセスログ：取得後<strong>1年間</strong></li>
            </ul>
          </li>
          <li>漏えい等の事案発生時は、原因究明・被害拡大防止・再発防止を実施し、必要に応じて利用者・関係機関へ通知します。</li>
        </ul>

        <h2 id="sec-8"><strong>第8条（開示・訂正・削除等の請求）</strong></h2>
        <p>
          利用者は、自己の個人情報について、開示・訂正・追加・削除・利用停止・第三者提供の停止等を請求できます。
          ご希望の際は、本人確認の上で法令に基づき対応します（手数料をいただく場合があります）。
        </p>
        <ul>
          <li>
            申請窓口：
            <Link href="/contact" className="underline underline-offset-2">お問い合わせフォーム</Link>
          </li>
          <li>回答方法：原則として電子的手段により行います（合理的期間内）</li>
        </ul>

        <h2 id="sec-9"><strong>第9条（未成年の利用）</strong></h2>
        <p>
          未成年が当サービスを利用する場合、法定代理人の同意を得たうえで行ってください。
          同意の確認が必要な場面では、当サービスが指定する手続に従っていただきます。
        </p>

        <h2 id="sec-10"><strong>第10条（改定・適用日）</strong></h2>
        <p>
          本ポリシーは、必要に応じて改定される場合があります。重要な改定についてはサイト上で告知します。
          改定後は当サービス上に掲載された時点から効力を生じます。
        </p>
        <p>制定日：{POLICY_ENACTED_AT}／最終改定日：{POLICY_REVISED_AT}</p>

        <h2 id="sec-11"><strong>第11条（お問い合わせ）</strong></h2>
        <p>個人情報の取扱いに関するお問い合わせは、以下からご連絡ください。</p>
        <ul>
          <li>
            フォーム：
            <Link href="/contact" className="underline underline-offset-2">お問い合わせフォーム</Link>
          </li>
          <li>メール：<span>info [at] me-ish.art</span>（送信時は「@」に置換）</li>
          <li>管理責任者：me-ish運営代表 大下唯</li>
        </ul>
      </article>
    </main>
  );
}
