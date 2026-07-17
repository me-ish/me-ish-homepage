// features/etorie/components/EtorieLanding.tsx
// /etorie ティザーLP。まだ事前登録は行わず、デモを見てもらうことに集中する
// コンパクト構成（2026-07-18 ユーザーフィードバック反映）:
// ヒーロー → 課題 → デモ導線のみ。機能の説明は /etorie/features に分離。
import Link from "next/link";
import EtorieStyles from "./EtorieStyles";

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
              コミッションの
              <br />
              受付から入金まで、
              <br />
              <span className="et-u">
                <span>これひとつ</span>
              </span>
              。
            </h1>
            <p className="et-lede">
              依頼の受付・見積もり・承諾・カード決済・案件管理・実績づくりを、ひとつの画面にまとめた受注管理ツールです。現役イラストレーターの実運用のなかで作っています。
            </p>
            <div className="et-cta-row">
              <Link href="/etorie/demo" className="et-btn">
                デモを見る（3分）
              </Link>
              <Link href="/etorie/features" className="et-btn et-btn-ghost">
                機能一覧
              </Link>
            </div>
            <p className="et-cta-note" style={{ marginTop: 12 }}>
              架空のクリエイター「ユキノ」の一日で、依頼から納品までを追いかけます
            </p>
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
            その時間を<b>描く時間</b>に戻すための道具です。
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
