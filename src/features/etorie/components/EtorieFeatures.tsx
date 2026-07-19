// features/etorie/components/EtorieFeatures.tsx
// /etorie/features 機能一覧。管理ツールと公開ページを一枚で紹介する。
// LP をコンパクトに保つため、機能の説明はすべてこのページに集約（2026-07-18）。
import Link from "next/link";
import EtorieStyles from "./EtorieStyles";

type Feature = { label: string; title: string; body: string };

const MANAGEMENT_FEATURES: Feature[] = [
  {
    label: "TABLEAU DE BORD",
    title: "ダッシュボード",
    body: "開いた瞬間に「今日の状況」。いちばん優先すべき案件、直近の納期、未対応の問い合わせ件数がまず目に入り、各ツールへここから移動します。",
  },
  {
    label: "RÉCEPTION",
    title: "問い合わせ管理",
    body: "依頼フォームから届いた相談が、状態（依頼受付/見積もり中/提示済み/入金待ち）と経過日数つきで並びます。放置が続くと色が変わるので、取りこぼしがなくなります。",
  },
  {
    label: "DEVIS",
    title: "見積もりツール",
    body: "依頼文を貼り付けると、自分の料金表から概算と内訳を自動計算。内訳つきの見積もりメール下書きまで一気に完成します。料金表は依頼元ごと（プラットフォーム別など）にプリセット保存できます。",
  },
  {
    label: "PAIEMENT",
    title: "承諾・決済",
    body: "見積もりメールにはワンクリック承諾ページのリンクが入り、承諾は金額・日時つきで記録。承諾後はカード決済リンクを発行して送信、入金はStripeの通知で自動確認され、案件が自動で制作開始に進みます。",
  },
  {
    label: "ATELIER",
    title: "案件管理（カレンダー）",
    body: "月カレンダーに案件の工程バーと納期が並び、案件カードには工程別タスクと納期ペース（残り作業から逆算した1日あたりの必要時間）。「今日のおすすめ順」が次に触る案件を提案します。",
  },
  {
    label: "REGISTRE",
    title: "売上・実績",
    body: "納品した案件は月別・種類別の売上集計と、作品サムネイルつきの実績一覧に自動で積み上がります。ツール導入前の過去実績も手入力で登録できます。",
  },
];

const PUBLIC_FEATURES: Feature[] = [
  {
    label: "VITRINE",
    title: "ポートフォリオ + 依頼フォーム",
    body: "作品ギャラリー・料金表・制作の流れ・依頼フォームがそろった公開ページ。文章・画像・料金はすべてブラウザの編集画面から差し替えられます。フォーム送信は問い合わせ管理に自動で入り、依頼者には受付確認メールが返ります。",
  },
  {
    label: "LIENS",
    title: "リンク集",
    body: "SNS・ショップ・各プラットフォームをまとめるプロフィールリンクページ。どのリンクが何回押されたかのクリック解析つきで、営業の効き目が見えます。",
  },
];

function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="et-features">
      {features.map((feature) => (
        <div key={feature.title} className="et-feature">
          <span className="et-f-label">{feature.label}</span>
          <h3>{feature.title}</h3>
          <p>{feature.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function EtorieFeatures() {
  return (
    <div className="etorie-page">
      <EtorieStyles />
      <div className="et-wrap">
        <header className="et-header">
          <Link
            href="/etorie"
            className="et-logotype"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="et-latin">
              <span className="et-e">é</span>trier
            </span>
            <span className="et-kana">エトリエ</span>
          </Link>
          <div className="et-byline">機能一覧</div>
        </header>

        <section className="et-section" style={{ borderTop: "none", paddingTop: 48 }}>
          <div className="et-sec-head">
            <span className="et-sec-eyebrow">FONCTIONS</span>
            <h2>管理ツール</h2>
          </div>
          <FeatureGrid features={MANAGEMENT_FEATURES} />
        </section>

        <section className="et-section">
          <div className="et-sec-head">
            <span className="et-sec-eyebrow">PAGES PUBLIQUES</span>
            <h2>公開ページ</h2>
          </div>
          <FeatureGrid features={PUBLIC_FEATURES} />
          <div className="et-cta-row" style={{ marginTop: 40 }}>
            <Link href="/etorie/demo/app" className="et-btn">
              実際の画面をさわってみる
            </Link>
            <Link href="/etorie/demo" className="et-btn et-btn-ghost">
              流れで見るデモ（3分）
            </Link>
            <Link href="/etorie" className="et-btn et-btn-ghost">
              ← 紹介ページへ
            </Link>
          </div>
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
