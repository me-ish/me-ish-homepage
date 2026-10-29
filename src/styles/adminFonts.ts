// src/styles/adminFonts.ts
// Natori 管理画面のゴシック体（Apple 以外の端末用）。以前は globals.css の Google Fonts @import で
// 読んでいたが、@import は全ページの表示を止めるため next/font に移した。
// 書体は同じ Noto Sans JP。管理画面で実際に使う文字の断片だけが読み込まれる（先読みはしない）。
import { Noto_Sans_JP } from "next/font/google";

export const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-jp",
  preload: false,
});
