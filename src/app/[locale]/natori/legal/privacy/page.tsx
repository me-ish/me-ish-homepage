import type { Metadata } from "next";
import NatoriLegalPage, {
  LegalSection,
} from "@/features/natori/components/legal/NatoriLegalPage";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜ナトリのあとりえ",
  description: "ナトリのあとりえ（Atelier Natori）における個人情報その他の利用者情報の取扱いについて定めたプライバシーポリシーです。",
};

export default function NatoriPrivacyPage() {
  return (
    <NatoriLegalPage
      title="プライバシーポリシー"
      lead="本ウェブサイト「ナトリのあとりえ（Atelier Natori）」を運営し、活動名「ナトリ」でイラスト制作を行う個人事業主（屋号：me-ish。以下「当方」といいます。）は、本ウェブサイトおよびイラスト制作業務において取得する個人情報その他の利用者情報を、以下のとおり取り扱います。"
    >
      <LegalSection title="1. 取得する情報">
        <p>
          当方は、ご相談、ご依頼、お見積もり、制作、決済および納品等に際して、氏名または活動名、メールアドレス、ご依頼内容、制作範囲、使用目的、商用利用の有無、予算、希望納期、公開条件、メッセージ、キャラクター資料、参考画像、参考URLその他利用者から提供された情報を取得する場合があります。
        </p>
        <p>
          ご依頼後は、ご相談ページでやりとりするメッセージおよび添付ファイル、お見積もりの承諾、お支払いの状況、納品データの受け取り確認の記録を取得します。
        </p>
        <p>
          また、不正利用、スパムその他のセキュリティ上の問題への対策のため、IPアドレスその他の技術情報を処理する場合があります。
        </p>
      </LegalSection>

      <LegalSection title="2. 利用目的">
        <p>
          取得した情報は、ご相談およびお問い合わせへの対応、ご依頼内容の確認、お見積もりの作成および提示、契約手続、依頼者との連絡、イラスト制作、修正対応、料金の請求および決済確認、制作物の納品、取引履歴および案件の管理、不正利用およびセキュリティ上の問題への対応、法令上必要となる対応、本ウェブサイトの利用状況の把握および改善、ならびにこれらに付随する業務のために利用します。
        </p>
        <p>取得した情報を、上記と無関係な広告・営業目的に利用することはありません。</p>
      </LegalSection>

      <LegalSection title="3. ご依頼時に提供された資料について">
        <p>
          キャラクター設定画、立ち絵、参考画像、参考URLその他の資料は、ご依頼内容の確認および制作のために使用します。
        </p>
        <p>当該ご依頼と無関係な作品制作、広告その他の目的に利用することはありません。</p>
      </LegalSection>

      <LegalSection title="4. 外部サービスの利用">
        <p>当方では、本ウェブサイトおよびご依頼管理業務を運営するため、以下の外部サービスを利用しています。</p>
        <div className="space-y-4">
          <div>
            <h3 className="font-black" style={{ color: "inherit" }}>Vercel</h3>
            <p>本ウェブサイトの配信およびサーバー処理等に利用します。</p>
          </div>
          <div>
            <h3 className="font-black" style={{ color: "inherit" }}>Supabase</h3>
            <p>案件情報、制作に必要となる情報およびアップロードされた資料等の保存・管理に利用します。</p>
          </div>
          <div>
            <h3 className="font-black" style={{ color: "inherit" }}>Resend</h3>
            <p>ご依頼受付、お見積もり、支払い案内、制作および納品等に関する電子メールの送信に利用します。</p>
          </div>
          <div>
            <h3 className="font-black" style={{ color: "inherit" }}>Stripe</h3>
            <p>クレジットカードによる決済処理に利用します。</p>
            <p>クレジットカード番号等の決済情報はStripe上で入力・処理され、当サイトのご依頼フォームでは取得しません。</p>
          </div>
          <div>
            <h3 className="font-black" style={{ color: "inherit" }}>Google アナリティクス、Vercel Web Analytics</h3>
            <p>本ウェブサイトのアクセス解析に利用します（「5. アクセス解析」をご覧ください）。</p>
          </div>
        </div>
        <p>これらの外部事業者には、それぞれのサービス提供に必要な範囲で情報が送信または保存される場合があります。</p>
        <p>これらの外部事業者には、米国の事業者が含まれます。外国にある事業者のサービスを利用するにあたっては、当該国における個人情報の保護に関する制度を把握したうえで、必要かつ適切な安全管理措置を講じます。</p>
      </LegalSection>

      <LegalSection title="5. アクセス解析">
        <p>
          本ウェブサイトでは、閲覧状況を把握してサイトを改善するため、Google LLC が提供する「Google アナリティクス」と、Vercel Inc. が提供する「Vercel Web Analytics」を利用しています。
        </p>
        <p>
          これらのサービスにより、閲覧したページ、参照元、ブラウザや端末の種類、おおよその地域などの情報が各事業者に送信されます。Google アナリティクスはCookieを利用します。当方がこれらのサービスに、氏名やメールアドレスなどご依頼フォームの入力内容を送信することはありません。
        </p>
        <p>
          ご依頼後にメールでお送りするご相談・お見積もり・納品の各ページでは、これらのアクセス解析を読み込まず、閲覧情報を送信しません。
        </p>
        <p>また、ボタンが押された回数などを当サイト独自に集計しています。この集計には、個人を特定する情報を含みません。</p>
        <p>
          Google アナリティクスによる情報の収集は、Google が提供する
          <a href="https://tools.google.com/dlpage/gaoptout?hl=ja" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            オプトアウトアドオン
          </a>
          で無効にできます。Google によるデータの取扱いは、
          <a href="https://policies.google.com/technologies/partner-sites?hl=ja" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Google のポリシー
          </a>
          をご確認ください。
        </p>
      </LegalSection>

      <LegalSection title="6. 第三者提供">
        <p>当方は、法令に基づく場合その他法令上認められる場合を除き、ご本人の同意なく個人情報を第三者へ提供しません。</p>
        <p>なお、本サービスの提供に必要な範囲で外部事業者に個人情報の取扱いを委託する場合があります。</p>
      </LegalSection>

      <LegalSection title="7. 情報の管理">
        <p>当方は、取得した情報への不正アクセス、紛失、漏えい、改ざんその他のリスクを防止するため、合理的な安全管理措置を講じます。</p>
      </LegalSection>

      <LegalSection title="8. 情報の保管期間">
        <p>
          取得した情報は、ご依頼への対応、取引履歴の管理、トラブルへの対応、法令上必要となる記録の保存その他業務上必要な期間保管します。
        </p>
        <p>保存の必要性がなくなった情報については、合理的な期間内に削除または適切な方法で廃棄します。</p>
      </LegalSection>

      <LegalSection title="9. 個人情報の開示・訂正・削除等">
        <p>
          ご本人から、自身の個人情報について開示、訂正、利用停止、削除その他法令上認められた請求があった場合は、ご本人であることを確認したうえで、法令に従って対応します。
        </p>
      </LegalSection>

      <LegalSection title="10. お問い合わせ">
        <p>個人情報の取扱いに関するお問い合わせ、および開示等のご請求は、次のメールアドレスまでお願いいたします。</p>
        <p>メールアドレス：<a href="mailto:info@me-ish.art" className="underline underline-offset-4">info@me-ish.art</a></p>
      </LegalSection>

      <LegalSection title="11. プライバシーポリシーの変更">
        <p>本ポリシーは、法令、サービス内容または利用する外部サービス等の変更に応じて改定する場合があります。</p>
        <p>重要な変更を行う場合は、本ウェブサイト上への掲載その他適切な方法でお知らせします。</p>
      </LegalSection>

      <p className="text-xs font-bold">制定日：2026年9月13日<br />最終改定日：2026年10月6日</p>
    </NatoriLegalPage>
  );
}
