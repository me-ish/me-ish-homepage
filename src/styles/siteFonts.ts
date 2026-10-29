// src/styles/siteFonts.ts
// Zen Maru Gothic をサイト全体で1つだけ読み込む（root layout と /natori/portfolio で共有）。
// 日本語フォントは unicode-range ごとに100以上のファイルへ分割されるため、先読み（preload）はしない。
// 先読みすると使わない断片まで毎回すべて取りに行き、表示が大きく遅れる。
import { Zen_Maru_Gothic } from "next/font/google";

export const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-zen",
  preload: false,
});
