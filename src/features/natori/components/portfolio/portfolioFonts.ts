// features/natori/components/portfolio/portfolioFonts.ts
// /natori/portfolio 専用フォント。CSS変数として配下に配布する。
import { Fredoka } from "next/font/google";
import { zenMaruGothic } from "@/styles/siteFonts";

// 日本語はサイト共通の1インスタンスを使う（別に読み込むと同じ書体を二重に取りに行く）。
export const portfolioFontJp = zenMaruGothic;

export const portfolioFontEn = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--pf-font-en",
  display: "swap",
});

/** 英字見出し・ボタン用の inline style（叩き台の fontEN 相当） */
export const fontEnStyle = { fontFamily: "var(--pf-font-en)" } as const;
