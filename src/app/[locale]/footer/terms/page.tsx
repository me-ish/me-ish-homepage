// app/footer/terms/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

// shadcn/ui
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type TocItem = [label: string, id: string];

const tocItems: TocItem[] = [
  ['適用・定義', 'sec-1'],
  ['規約の変更', 'sec-2'],
  ['アカウント等', 'sec-3'],
  ['知的財産権', 'sec-4'],
  ['禁止行為', 'sec-5'],
  ['展示・販売', 'sec-6'],
  ['代金の支払（購入者向け）', 'sec-7'],
  ['売上の支払（アーティスト向け）', 'sec-7-2'],
  ['引渡し', 'sec-8'],
  ['返金・キャンセル', 'sec-9'],
  ['免責事項・責任制限', 'sec-10'],
  ['サービスの変更等', 'sec-11'],
  ['未成年・反社排除', 'sec-12'],
  ['連絡・広告メール', 'sec-13'],
  ['準拠法・管轄', 'sec-14'],
  ['分離可能性', 'sec-15'],
  ['施行日・改定', 'sec-16'],
];

export default function TermsPage() {
  const locale = useLocale();
  const t = useTranslations();
  // 追従のON/OFF（スクロールにより “目次が邪魔” を防ぐ調整用）
  const [isSticky, setIsSticky] = useState(true);

  useEffect(() => {
    // 画面が小さい時は sticky にしない（目次が邪魔になりやすい）
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setIsSticky(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const Toc = useMemo(() => {
    return (
      <nav className="mt-2 grid gap-1">
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
    );
  }, []);

  if (locale === 'en') {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-6">
        <p className="text-gray-500 text-center max-w-md">{t('jaOnly')}</p>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10">
      {/* ヘッダ */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">利用規約</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          本規約は、オンラインアートギャラリー「me-ish」（以下「当サービス」）の利用条件を定めるものであり、
          作品の閲覧・購入・出展その他すべての利用者に適用されます。
        </p>
      </header>

      {/* 目次（SP: 折りたたみ / PC: 追従カード） */}
      <aside
        className={[
          'mb-8 rounded-2xl border bg-gray-50 p-4',
          'md:float-right md:ml-8 md:w-72',
          isSticky ? 'md:sticky md:top-6' : '',
        ].join(' ')}
        aria-label="目次"
      >
        {/* ✅ デフォルト折りたたみ（defaultValue なし） */}
        <Accordion type="single" collapsible>
          <AccordionItem value="toc" className="border-none">
            <AccordionTrigger className="py-1 text-sm font-semibold text-gray-900 hover:no-underline">
              目次
            </AccordionTrigger>
            <AccordionContent className="pt-2">{Toc}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>

      {/* 本文 */}
      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2 id="sec-1">
          <strong>第1条（適用・定義）</strong>
        </h2>
        <p>
          1. 本規約は、当サービスを利用するすべての者（以下「利用者」）に適用されます。
          利用者には、作品を閲覧・購入する者（以下「購入者」）および作品を出展する者（以下「アーティスト」）を含みます。
        </p>
        <p>
          2. 当サービスは、作品のオンライン展示・販売（デジタル作品の販売を含む）等を提供します。詳細は
          <Link href="/footer/tokushoho" className="underline underline-offset-2">
            特定商取引法に基づく表記
          </Link>
          および
          <Link href="/footer/privacy" className="underline underline-offset-2">
            プライバシーポリシー
          </Link>
          を併せてご確認ください。
        </p>

        <h2 id="sec-2">
          <strong>第2条（規約の変更）</strong>
        </h2>
        <p>
          当サービスは、必要に応じて本規約を変更できます。重要な変更は本サイト上での掲示その他相当の方法により周知し、
          変更後に利用者が当サービスを利用した場合、変更後の規約に同意したものとみなします。
        </p>

        <h2 id="sec-3">
          <strong>第3条（アカウント・認証）</strong>
        </h2>
        <p>
          1. 一部機能では、メール認証や外部ID連携（例：Google）を用いる場合があります。利用者は、登録情報を正確に維持し、
          不正利用が生じないよう自己の責任で管理するものとします。
        </p>
        <p>
          2. 利用者は、
          <Link href="/contact" className="underline underline-offset-2">
            お問い合わせフォーム
          </Link>
          から退会（アカウント削除）を申請できます。退会の申請があった場合、当サービスは本人確認の上、
          合理的期間内にアカウントおよび関連データを削除します。ただし、法令に基づく保存義務がある情報、
          取引記録、不正利用防止に必要な情報は、所定の期間保持する場合があります（
          <Link href="/footer/privacy#sec-7" className="underline underline-offset-2">
            プライバシーポリシー 第7条
          </Link>
          参照）。
        </p>

        <h2 id="sec-4">
          <strong>第4条（知的財産権・利用許諾）</strong>
        </h2>
        <p>
          1. 当サービス上に表示される作品（画像・映像・音声・テキスト・3Dデータ等）の著作権その他一切の知的財産権は、
          各権利者に帰属します。
        </p>
        <p>
          2. 利用者は、権利者の明示的な許諾なく、複製・転載・改変・頒布・公衆送信・スクレイピング・データセット化・AI学習利用等を
          行ってはなりません。
        </p>
        <p>
          3. アーティストは、当サービスによる本サイト・ギャラリー内での表示、当サービスの告知・広報・作品紹介（SNS投稿・サムネイル生成等を含む）の範囲で、
          無償・非独占的に作品等を利用する権利を当サービスに許諾します。上記には、ウォーターマークやAI認識阻害処理の付与も含みます。
        </p>
        <p>
          4. 購入者は、購入したデジタル作品を<strong>私的利用の範囲</strong>で閲覧・保存・表示できます。ただし、商用利用・二次配布・再販売・二次創作の公開等は、
          権利者の事前許諾が必要です。購入により著作権・著作者人格権その他一切の権利が移転するものではありません。
        </p>

        <h2 id="sec-5">
          <strong>第5条（禁止行為）</strong>
        </h2>
        <ul>
          <li>作品の無断保存・転載・スクレイピング・自動取得・データベース化</li>
          <li>AI学習・モデル評価・類似モデル生成等への利用</li>
          <li>権利・名誉・信用・プライバシーを侵害する行為</li>
          <li>不正アクセス、改ざん、過度な負荷を与える行為</li>
          <li>公序良俗・法令に反する行為</li>
          <li>当サービス運営を妨げる行為</li>
        </ul>

        <h2 id="sec-6">
          <strong>第6条（展示・販売）</strong>
        </h2>
        <p>
          展示可否・掲載期間・配置等は、当サービスの基準により決定されます。販売はデジタル作品（データ）の販売として行い、
          価格は税込表示です。
        </p>
        <p>
          任意の「表示保証オプション」は<strong>1作品ごと</strong>に購入でき、有効期間内に所定回数の表示を保証します。自動更新は行いません。
          保証回数の消化は当サービスのログにより判定し、表示の時間帯・位置・デバイス最適化は当サービスの裁量とします。
          役務の性質上、消化済み回数分については返金できません（詳細は
          <Link href="/modal/pricing" className="underline underline-offset-2">
            プランと料金
          </Link>
          参照）。
        </p>
        <p>
          （通信販売の表示）当サービスは、購入導線上において、販売価格（消費税込）、支払方法・支払時期、引渡時期（又は権利移転時期）、
          申込み期間の有無、返品・キャンセルに関する特約（返品特約）その他法令で求められる事項を、容易に認識できる方法で表示します。
        </p>
        <p>購入後も、展示期間中は「SOLD」等の表示付きで作品を表示する場合があります。</p>

        <h2 id="sec-7">
          <strong>第7条（代金の支払：購入者向け）</strong>
        </h2>
        <p>
          支払は、当サービスが指定する Stripe による<strong>クレジットカード決済（日本円）</strong>によります。暗号資産による支払には対応していません。
          なお、決済に係る Stripe の手数料は原則として当サービスが負担します（購入者に別途請求しません）。
        </p>
        <p>
          （電子契約の確認）当サービスは、購入確定の直前に<strong>最終確認画面</strong>を設け、商品名、数量、合計金額（税・手数料等を含む）、支払方法、
          引渡方法を表示し、利用者が訂正できる措置を講じます。
        </p>
        <p>
          （契約成立時点）売買契約は、購入者が最終確認画面で「購入を確定する」等のボタンをクリックし、
          <strong>決済処理が正常に完了した時点</strong>で成立します。
        </p>

        <h2 id="sec-7-2">
          <strong>第7条の2（売上の支払：アーティスト向け）</strong>
        </h2>
        <p>
          1. 当サービスは、アーティストの<strong>代理受領者</strong>として購入代金を受領します。購入者が当サービス又は当サービスが指定する決済事業者に支払った時点で、
          購入者のアーティストに対する支払債務は弁済により消滅します。当サービスは受領代金から<strong>販売手数料10%</strong>等の所定費用を控除のうえ、
          アーティストへ精算します（振込口座の登録が必要）。
        </p>
        <p>
          2. 振込は原則として<strong>月末締め・翌月25日払い</strong>（25日が金融機関休業日の場合は翌営業日）で行います。
          <strong>最低振込金額の制限はありません</strong>。振込手数料は<strong>当サービスが負担</strong>します。
        </p>
        <p>
          3. 振込明細の確認方法その他の条件は、当サービスが別途定める方針・FAQに従うものとします。取引に係る税務上の取扱いは、
          各当事者の責任において処理します。なお、当サービスは適格請求書発行事業者ではないため、インボイス（適格請求書）の発行には対応しておりません。（参考：
          <Link href="/footer/faq#fees" className="underline underline-offset-2">
            FAQ：手数料・支払
          </Link>
          ）
        </p>

        <h2 id="sec-8">
          <strong>第8条（引渡し）</strong>
        </h2>
        <p>
          1. 当サービスにおける販売はデジタル納品とし、購入完了後に当サービスが指定する方法（メール通知またはダウンロードリンク等）により、
          購入者へ提供します。
        </p>
        <p>
          2. 提供方法、再ダウンロードの可否、ダウンロード期限その他の条件は、購入導線上またはFAQ等にて表示します。
        </p>
        <p>
          3. 購入者の通信環境、端末設定、メール受信設定その他購入者側の事情により提供物を受領できない場合、当サービスは合理的な範囲で再送等の対応を行いますが、
          当該事情に起因する損害について責任を負いません。
        </p>

        <h2 id="sec-9">
          <strong>第9条（返金・キャンセル）</strong>
        </h2>
        <p>
          1. デジタル商品の性質上、購入確定後のキャンセル・返金は<strong>原則不可</strong>です。表示保証オプションその他役務についても、
          提供開始後および消化済部分は返金できません。
        </p>
        <p>
          2. ただし、(i) 重複課金、(ii) 当サービスに起因する引渡不能・重大な欠陥があり合理的期間内に回復不能、(iii) 法令上の瑕疵がある場合は、
          購入後<strong>7日以内</strong>の申出に限り返金等に応じます。
        </p>
        <p>
          3. 通信販売にはクーリング・オフは適用されません。返品特約の詳細は
          <Link href="/footer/tokushoho" className="underline underline-offset-2">
            特定商取引法に基づく表記
          </Link>
          にも表示します。
        </p>

        <h2 id="sec-10">
          <strong>第10条（免責事項・責任制限）</strong>
        </h2>
        <p>1. 当サービスは、提供情報や機能の正確性・完全性・有用性・安全性を保証しません。</p>
        <p>
          2. 当サービスは、故意または重過失による場合を除き、当サービスの債務不履行または不法行為により利用者に生じた
          <strong>直接かつ通常の損害</strong>の範囲で、<strong>過去12か月間に利用者が当サービスに実際に支払った対価総額</strong>を上限として賠償責任を負います。
          ただし、生命・身体の侵害、知的財産権侵害、個人情報保護法違反については本上限を適用しません。
        </p>

        <h2 id="sec-11">
          <strong>第11条（サービスの変更等）</strong>
        </h2>
        <p>運営上必要な場合、事前予告なく内容の変更・中断・終了を行うことがあります。</p>

        <h2 id="sec-12">
          <strong>第12条（未成年・反社会的勢力の排除）</strong>
        </h2>
        <p>1. 未成年の利用は、親権者等法定代理人の同意がある場合に限ります。</p>
        <p>
          2. 利用者は、自己または関係者が反社会的勢力に該当しないこと、または関与しないことを表明・保証し、該当が判明した場合、
          当サービスは何らの通知なく利用停止・契約解除等の措置を講じることができます。
        </p>

        <h2 id="sec-13">
          <strong>第13条（連絡・広告メール）</strong>
        </h2>
        <p>
          当サービスからの通知は、サイト上の掲示、登録メールアドレスへの送信、その他適当と判断する方法により行います。
          広告宣伝メールは<strong>事前同意（オプトイン）</strong>を得た場合に限り配信し、本文に送信者情報と<strong>配信停止リンク</strong>を表示します。
          海外の事業者（例：決済・配信事業者）へ個人データを移転する場合があり、その移転先・目的・講じる措置は
          <Link href="/footer/privacy" className="underline underline-offset-2">
            プライバシーポリシー
          </Link>
          に定めます。
        </p>

        <h2 id="sec-14">
          <strong>第14条（準拠法・管轄）</strong>
        </h2>
        <p>本規約は日本法を準拠法とします。紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>

        <h2 id="sec-15">
          <strong>第15条（分離可能性）</strong>
        </h2>
        <p>
          本規約のいずれかの条項が無効または執行不能と判断された場合でも、その他の条項は引き続き有効に存続します。
        </p>

        <h2 id="sec-16">
          <strong>第16条（施行日・改定）</strong>
        </h2>
        <p>施行日：2025年8月18日</p>
        <p>改定日：2026年1月17日</p>
      </article>
    </main>
  );
}
