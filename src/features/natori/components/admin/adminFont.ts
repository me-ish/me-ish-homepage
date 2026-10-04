// features/natori/components/admin/adminFont.ts
// 管理画面（ダッシュボード〜編集画面）の本文フォント。CSS変数として配下に配布する。
// Apple 端末では端末のヒラギノを優先し、それ以外の端末でこのフォントを使う（globals.css）。
import { Noto_Sans_JP } from "next/font/google";

export const natoriAdminFont = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-natori-admin",
  display: "swap",
  // 日本語フォントは unicode-range ごとに多数のファイルへ分割される。
  // 全断片の preload は初期転送を圧迫するため、実際に使う文字だけ通常読込する。
  preload: false,
});
