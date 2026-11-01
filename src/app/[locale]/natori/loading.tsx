// app/[locale]/natori/loading.tsx
// ナトリ配下のページ移動中は、共通の青いスピナー（src/app/loading.tsx、旧 me-ish の色）を出さない。
// 公開ページはサーバーで描画されてすぐ届くので、何も出さずに次のページを待つ。
export default function NatoriLoading() {
  return null;
}
