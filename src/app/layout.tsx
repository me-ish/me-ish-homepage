// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";

import QueryProvider from "@/components/providers/QueryProvider";
import { ZoomArtworkProvider } from "@/components/shared/ZoomArtworkContext";
import ClientWrapper from "@/components/shared/ClientWrapper";
import ZoomArtworkDisplay from "@/components/shared/ZoomArtworkDisplay";
import { Analytics } from "@/components/Analytics";
import "@/styles/aiPortfolioFonts.css";

// ✅ OG/Twitter画像などの絶対URL解決の基準（Vercel warning 対策）
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.me-ish.art";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: "me-ish",
  description: "アートを、もっと近くに。",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      {/* 全体は今までどおり font-zen ベース */}
      <body className="text-lg leading-relaxed text-[#333]">
        <Suspense fallback={null}>
          <QueryProvider>
            <ZoomArtworkProvider>
              <ClientWrapper>
                {children}
                <ZoomArtworkDisplay />
                <Analytics />
              </ClientWrapper>
            </ZoomArtworkProvider>
          </QueryProvider>
        </Suspense>
      </body>
    </html>
  );
}
