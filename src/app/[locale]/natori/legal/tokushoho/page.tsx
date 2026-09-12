import type { Metadata } from "next";
import NatoriLegalPage, {
  LegalDefinition,
} from "@/features/natori/components/legal/NatoriLegalPage";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | Atelier Natori",
  description: "Atelier Natori のイラスト制作依頼に関する特定商取引法に基づく表記です。",
};

export default function NatoriTokushohoPage() {
  return (
    <NatoriLegalPage
      title="特定商取引法に基づく表記"
      lead="Atelier Natori を通じて直接お受けするイラスト制作依頼について、取引条件を以下のとおり表示します。"
    >
      <dl>
        <LegalDefinition term="サイト名">Atelier Natori</LegalDefinition>
        <LegalDefinition term="屋号">me-ish</LegalDefinition>
        <LegalDefinition term="活動名">ナトリ</LegalDefinition>
        <LegalDefinition term="販売事業者の氏名">
          <p>ご請求があった場合、遅滞なく開示いたします。</p>
        </LegalDefinition>
        <LegalDefinition term="所在地">
          <p>ご請求があった場合、遅滞なく開示いたします。</p>
        </LegalDefinition>
        <LegalDefinition term="電話番号">
          <p>ご請求があった場合、遅滞なく開示いたします。</p>
        </LegalDefinition>
        <LegalDefinition term="事業者情報の開示">
          <p>
            販売事業者の氏名、所在地および電話番号の開示をご希望の場合は、当サイトのご依頼フォームまたは当方からご案内するメールアドレスよりご連絡ください。
          </p>
          <p>
            契約のお申込みを判断する前に確認いただけるよう、ご請求を確認後、電子メール等により遅滞なく開示いたします。
          </p>
        </LegalDefinition>
        <LegalDefinition term="お問い合わせ先">
          <p>当サイトのご依頼フォーム、または当方からご案内するメールアドレスよりお問い合わせください。</p>
        </LegalDefinition>
        <LegalDefinition term="提供するサービス">
          <p>オーダーメイドによるイラスト制作およびこれに付随するサービス。</p>
          <p>
            主に、SDキャラクター、胸上・膝〜腰上・全身イラスト、一枚絵、立ち絵、動画・配信用イラスト、量産イラストその他個別に合意したイラスト制作を行います。
          </p>
        </LegalDefinition>
        <LegalDefinition term="販売価格・役務の対価">
          <p>基本料金および各種追加料金は、当サイトの料金表に表示します。</p>
          <p>
            最終的な料金は、ご依頼内容、制作範囲、人物数、小物・背景、表情差分、商用利用、公開条件、納期その他の条件を確認したうえで個別にお見積もりし、契約成立前に支払総額を提示します。
          </p>
          <p>
            当サイトに表示された基本料金と個別のお見積もり内容が異なる場合は、依頼者が承諾した最新のお見積もり内容を適用します。
          </p>
        </LegalDefinition>
        <LegalDefinition term="販売価格以外に必要となる費用">
          <p>
            当サイトの利用または電子メール等の送受信に必要となるインターネット接続料金、通信料金その他利用者側で発生する費用は、利用者の負担となります。
          </p>
          <p>通常のデジタルデータ納品について、送料は発生しません。</p>
          <p>その他の費用が発生する場合は、契約成立前にご案内します。</p>
        </LegalDefinition>
        <LegalDefinition term="支払方法">
          <p>原則としてStripeを利用したクレジットカード決済となります。</p>
          <p>当方と依頼者との間で別の支払方法について個別に合意した場合は、その合意した方法によります。</p>
        </LegalDefinition>
        <LegalDefinition term="支払時期">
          <p>お見積もりをご承諾いただいた後、当方から支払い用リンクを電子メールでお送りします。</p>
          <p>支払い案内メールの送信日から7日以内にお支払いください。</p>
          <p>支払期限を過ぎた場合は、制作スケジュールやお見積もり内容を再確認させていただく場合があります。</p>
        </LegalDefinition>
        <LegalDefinition term="ご依頼フォームについて">
          <p>当サイトのご依頼フォームは、ご相談およびお見積もり依頼を受け付けるためのものです。</p>
          <p>ご依頼フォームを送信しただけでは、イラスト制作契約は成立しません。</p>
        </LegalDefinition>
        <LegalDefinition term="契約の成立時期">
          <p>
            当方が提示したお見積もりについて、依頼者が専用の見積承諾ページで内容を確認し、依頼を確定する操作を行った時点で、そのお見積もり内容について契約が成立します。
          </p>
          <p>内容の変更を希望する場合は、承諾操作を行う前にお見積もりメールへ返信してご相談ください。</p>
        </LegalDefinition>
        <LegalDefinition term="見積もりの有効期限">
          <p>お見積もりの有効期限は、原則として見積メール送信日から30日間です。</p>
          <p>有効期限を過ぎた場合は、料金、納期その他の条件を再確認し、改めてお見積もりする場合があります。</p>
        </LegalDefinition>
        <LegalDefinition term="制作開始時期">
          <p>原則として、ご入金の確認後に制作を開始します。</p>
        </LegalDefinition>
        <LegalDefinition term="納品時期">
          <p>通常は、ご入金確認後から約1か月での納品を目安としています。</p>
          <p>ご依頼内容、修正状況、制作スケジュールその他の事情により前後する場合があります。</p>
          <p>お急ぎの場合は、制作内容およびスケジュールに応じ、7〜14日程度で対応できる場合があります。</p>
          <p>具体的な納期について個別のお見積もりまたは電子メール等で合意した場合は、その内容を優先します。</p>
        </LegalDefinition>
        <LegalDefinition term="納品方法">
          <p>完成したイラストデータを、当方が指定するオンライン上の方法により納品します。</p>
        </LegalDefinition>
        <LegalDefinition term="修正について">
          <p>通常プランでは、カラーラフ段階におけるリテイクを2回まで無料としています。</p>
          <p>構図、ポーズ、表情、配色等の大幅な変更は、原則としてカラーラフ確認時までにお申し出ください。</p>
          <p>清書後は、色味等の軽微な修正を中心に対応します。</p>
          <p>
            無料修正回数を超える修正や、当初の依頼内容から大きく変更する追加作業については、追加料金が発生する場合があります。その場合は、作業を行う前に料金をご案内します。
          </p>
        </LegalDefinition>
        <LegalDefinition term="契約成立後のキャンセルについて">
          <p>お見積もり承諾後にキャンセルをご希望の場合は、速やかに電子メールにてご連絡ください。</p>
          <p>
            ご入金後または制作開始後のキャンセルについては、制作の進行状況、既に実施した作業内容、発生済みの費用その他の事情を確認したうえで、返金の可否および精算額を個別にご案内します。
          </p>
          <p>既に制作に着手している場合には、実施済みの作業に相当する費用をご負担いただく場合があります。</p>
        </LegalDefinition>
        <LegalDefinition term="納品後の返品・返金について">
          <p>
            本サービスは、ご依頼者ごとに個別に制作するオーダーメイドのデジタルコンテンツであるため、納品後の依頼者都合による返品・返金は原則としてお受けしておりません。
          </p>
          <p>当方の責めに帰すべき制作物の不備がある場合は、内容を確認のうえ、修正その他適切な方法で対応します。</p>
          <p>閲覧端末やディスプレイの設定等による色味の差異については、制作物の不備に該当しない場合があります。</p>
        </LegalDefinition>
        <LegalDefinition term="クーリング・オフについて">
          <p>通信販売には、訪問販売等に適用されるクーリング・オフ制度は適用されません。</p>
        </LegalDefinition>
        <LegalDefinition term="外部プラットフォームを利用したご依頼">
          <p>
            「つなぐ」その他の外部プラットフォームを通じて成立する取引については、各プラットフォームの利用規約、支払条件、キャンセル条件その他の取引条件が適用されます。
          </p>
          <p>本表記のうち当サイトにおける直接取引に関する事項は、原則として当サイトから直接成立する取引を対象とします。</p>
        </LegalDefinition>
        <LegalDefinition term="制定日">2026年9月13日</LegalDefinition>
      </dl>
    </NatoriLegalPage>
  );
}
