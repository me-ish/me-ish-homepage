// features/natori/components/portfolio/portfolioFonts.ts
// /natori/portfolio 専用フォント。CSS変数として配下に配布する。
import { Fredoka, Zen_Maru_Gothic } from "next/font/google";

export const portfolioFontJp = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--pf-font-jp",
  display: "swap",
  // 日本語フォントは unicode-range ごとに多数のファイルへ分割される。
  // 全断片の preload は初期転送を圧迫するため、実際に使う文字だけ通常読込する。
  preload: false,
});

export const portfolioFontEn = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--pf-font-en",
  display: "swap",
});

/** 英字見出し・ボタン用の inline style（叩き台の fontEN 相当） */
export const fontEnStyle = { fontFamily: "var(--pf-font-en)" } as const;
