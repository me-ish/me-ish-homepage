// 管理画面の Noto Sans JP を、管理画面を開いたときだけ読み込む。
// #200 より前は globals.css の @import で全ページが読んでいたものを、管理画面だけに絞った。
// next/font にしないのは、サーバー側で Google Fonts を取りに行かせないため
// （ネットワークを切った CI の試験環境で、取得の失敗と再試行が開発サーバーの動きを乱す）。
// ブラウザが取得できないときは、globals.css の後続の書体（Yu Gothic UI など）で表示される。
const NOTO_SANS_JP_CSS = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap";

export function NatoriAdminFont() {
  return <link rel="stylesheet" href={NOTO_SANS_JP_CSS} />;
}
