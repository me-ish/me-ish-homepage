// features/etorie/components/EtorieLanding.tsx
// /etorie ティザーLP。承認済みデザインモック（2026-07-14 Artifact）の Next.js 化。
// 事前登録は現時点ではメール導線（DB保存つきフォームは正式公開の準備時に実装）。
import Link from "next/link";
import EtorieStyles from "./EtorieStyles";

const PREREGISTER_MAILTO =
  "mailto:info@me-ish.art?subject=" +
  encodeURIComponent("【エトリエ】事前登録") +
  "&body=" +
  encodeURIComponent(
    "エトリエの正式公開のお知らせを希望します。\n\nお名前（活動名）: \nよろしければ普段の受注方法（DM / 各種プラットフォーム など）: \n"
  );

export default function EtorieLanding() {
  return (
    <div className="etorie-page">
      <EtorieStyles />
      <div className="et-wrap">
        <header className="et-header">
          <div className="et-logotype">
            <span className="et-latin">
              <span className="et-e">é</span>trier
            </span>
            <span className="et-kana">エトリエ</span>
          </div>
          <div className="et-byline">
            by <b>me-ish</b>
          </div>
        </header>

        <div className="et-hero">
          <div>
            <span className="et-eyebrow">イラストレーターのための受注管理</span>
            <h1>
              描くあなたを、
              <br />
              <span className="et-u">
                <span>支える道具</span>
              </span>
              。
            </h1>
            <p className="et-lede">
              エトリエは、イラストコミッションの<b>受付から入金まで</b>
              をひとつにする受注管理ツール。 DMの海に沈む依頼、毎回ゼロから書く見積もり、手動の入金確認——
              描く時間を奪うぜんぶを、エトリエが引き受けます。
            </p>
            <div className="et-cta-row">
              <Link href="/etorie/demo" className="et-btn">
                3分でわかるデモを見る
              </Link>
              <a href={PREREGISTER_MAILTO} className="et-btn et-btn-ghost">
                事前登録する（無料）
              </a>
            </div>
          </div>

          <div className="et-mock" role="img" aria-label="問い合わせ一覧のイメージ画面">
            <div className="et-mock-bar">
              <span className="et-t">問い合わせ</span>
              <span className="et-badge">未対応 2件</span>
            </div>
            <div className="et-row">
              <span className="et-name">ゆきうさぎ 様</span>
              <span className="et-sub">立ち絵・全身</span>
              <span className="et-chip alert">受付から 3日</span>
            </div>
            <div className="et-row">
              <span className="et-name">Kanata 様</span>
              <span className="et-sub">SNSアイコン</span>
              <span className="et-chip warn">見積もり送付済み</span>
            </div>
            <div className="et-row">
              <span className="et-name">ちくわ工房 様</span>
              <span className="et-sub">一枚絵・商用</span>
              <span className="et-chip ok">入金済み・制作中</span>
            </div>
            <div className="et-row">
              <span className="et-name">mio 様</span>
              <span className="et-sub">TRPG立ち絵</span>
              <span className="et-chip ok">納品完了</span>
            </div>
            <div className="et-mock-foot">
              支払いリンクの決済を確認しました — 「ちくわ工房 様」の制作を開始できます
            </div>
          </div>
        </div>

        <section className="et-section">
          <div className="et-sec-head">
            <span className="et-sec-eyebrow">PROBLÈME</span>
            <h2>こんな受注、していませんか</h2>
          </div>
          <div className="et-pains">
            <div className="et-pain">
              依頼がDMとメールとリプライに散らばって、どれが未返信かわからない
            </div>
            <div className="et-pain">見積もりと請求の文章を、毎回ゼロから書いている</div>
            <div className="et-pain">
              「ご入金確認しました、着手します」の往復を手動でやっている
            </div>
            <div className="et-pain">
              今月いくら売り上げたか、スプレッドシートで手集計している
            </div>
          </div>
          <p className="et-pains-close">
            その時間、ぜんぶ<b>描く時間</b>に戻せます。
          </p>
        </section>

        <section className="et-section">
          <div className="et-sec-head">
            <span className="et-sec-eyebrow">FONCTIONS</span>
            <h2>受付から入金まで、ひとつに</h2>
          </div>
          <div className="et-features">
            <div className="et-feature">
              <span className="et-f-label">RÉCEPTION</span>
              <h3>依頼はフォームに集約</h3>
              <p>
                専用の依頼フォームとポートフォリオページ。届いた依頼は放置日数つきの一覧に並び、取りこぼしがなくなります。依頼者には受付確認メールが自動で届きます。
              </p>
            </div>
            <div className="et-feature">
              <span className="et-f-label">DEVIS</span>
              <h3>見積もりも請求もワンクリック</h3>
              <p>
                金額と内訳が入った見積もりメールの下書きが自動で完成。承諾をもらったら、カード決済リンクつきの支払い依頼をワンボタンで送信できます。
              </p>
            </div>
            <div className="et-feature">
              <span className="et-f-label">ATELIER</span>
              <h3>入金したら、自動で制作開始</h3>
              <p>
                入金確認は自動。案件は「入金前は手を動かさない」設計で、タスクチェックとカレンダーが納期まで並走します。
              </p>
            </div>
            <div className="et-feature">
              <span className="et-f-label">REGISTRE</span>
              <h3>売上と実績が、勝手にたまる</h3>
              <p>
                月別・種類別の売上、作品サムネイルつきの実績一覧。確定申告の季節も、営業実績のアピールも、ここを見るだけ。
              </p>
            </div>
          </div>
        </section>

        <section className="et-section">
          <div className="et-sec-head">
            <span className="et-sec-eyebrow">PARCOURS</span>
            <h2>依頼から入金までの流れ</h2>
          </div>
          <div className="et-flow">
            <div className="et-step">
              <span className="et-n">1</span>
              <h3>依頼が届く</h3>
              <p>フォームから内容と資料つきで受付。</p>
              <span className="et-auto">自動返信</span>
            </div>
            <div className="et-step">
              <span className="et-n">2</span>
              <h3>見積もりを送る</h3>
              <p>金額を入れるだけで文面が完成。</p>
            </div>
            <div className="et-step">
              <span className="et-n">3</span>
              <h3>承諾の返信</h3>
              <p>依頼者はボタンを押すだけでOK。</p>
            </div>
            <div className="et-step">
              <span className="et-n">4</span>
              <h3>支払いリンク</h3>
              <p>カード決済リンクを自動発行して送信。</p>
            </div>
            <div className="et-step">
              <span className="et-n">5</span>
              <h3>入金、制作開始</h3>
              <p>入金を自動確認して案件が動き出す。</p>
              <span className="et-auto">自動確認</span>
            </div>
          </div>
          <div className="et-cta-row" style={{ marginTop: 34 }}>
            <Link href="/etorie/demo" className="et-btn">
              この流れをデモで体験する
            </Link>
            <span className="et-cta-note">架空のクリエイター「ユキノ」の一日を追いかけます</span>
          </div>
        </section>

        <section className="et-section">
          <div className="et-duo">
            <div className="et-panel">
              <h3>現役イラストレーターとの二人三脚から</h3>
              <p>
                エトリエは、コミッションを受け続けるイラストレーターの実運用のなかで作られました。机上の機能ではなく、「現場で毎週使われて残ったもの」だけが入っています。
              </p>
            </div>
            <div className="et-panel">
              <h3>料金（予定）</h3>
              <p>
                <span className="et-price et-serif">月額制・準備中</span>
                売上からの手数料はいただきません。かかるのはカード決済の実費のみ。詳細は正式公開時に発表します。
              </p>
            </div>
          </div>
        </section>

        <section className="et-register" id="register">
          <span className="et-sec-eyebrow">INSCRIPTION</span>
          <h2>正式公開を、いちばん先に</h2>
          <p className="et-sub">
            事前登録いただいた方に、公開のお知らせと先行案内をお送りします。
          </p>
          <div className="et-cta-row" style={{ justifyContent: "center" }}>
            <a href={PREREGISTER_MAILTO} className="et-btn">
              メールで事前登録する
            </a>
          </div>
          <p className="et-cta-note" style={{ marginTop: 14 }}>
            件名・本文は自動で入ります。送信いただくだけで登録完了です。
          </p>
        </section>

        <footer className="et-footer">
          <span>
            <span className="et-serif" style={{ fontStyle: "italic" }}>
              étrier
            </span>
            （エトリエ）= 仏語で「鐙（あぶみ）」。乗り手を支える道具。
          </span>
          <span>© 2026 me-ish ｜ 開発中のサービスです（名称・内容は変更になる場合があります）</span>
        </footer>
      </div>
    </div>
  );
}
