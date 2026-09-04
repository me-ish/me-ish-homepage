// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Zen_Maru_Gothic, Lilita_One } from "next/font/google";
import { getLocale } from "next-intl/server";

import QueryProvider from "@/components/providers/QueryProvider";
import { ZoomArtworkProvider } from "@/components/shared/ZoomArtworkContext";
import ClientWrapper from "@/components/shared/ClientWrapper";
import ZoomArtworkDisplay from "@/components/shared/ZoomArtworkDisplay";
import { Analytics } from "@/components/Analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import "@/styles/auraFonts.css";

// フォントを事前読み込み（レンダリングブロッキングを回避）
const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-zen",
});

const lilitaOne = Lilita_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lilita",
});

// ✅ OG/Twitter画像などの絶対URL解決の基準（Vercel warning 対策）
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.me-ish.art";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: "me-ish",
  description: "あなたらしさを、かたちに。",
  manifest: "/manifest.json",

  // ✅ 追加：タブ / ブックマーク / iOS用アイコン
  icons: {
    icon: [
      { url: "/favicon2.png" }, // これがタブの基本
      // PNGも置くなら追加（任意）
      // { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },

  // AI学習クローラーの拒否
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
    },
  },

  // その他のメタタグ（AI学習拒否）
  other: {
    "robots": "noai, noimageai",
  },
};


export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${zenMaruGothic.variable} ${lilitaOne.variable}`}>
      {/* 全体は今までどおり font-zen ベース */}
      <body className="font-zen text-lg leading-relaxed text-[#333]">
        <Suspense fallback={null}>
          <QueryProvider>
            <ZoomArtworkProvider>
              <ClientWrapper>
                {children}
                <ZoomArtworkDisplay />
                <Analytics />
                <VercelAnalytics />
              </ClientWrapper>
            </ZoomArtworkProvider>
          </QueryProvider>
        </Suspense>
      </body>
    </html>
  );
}
