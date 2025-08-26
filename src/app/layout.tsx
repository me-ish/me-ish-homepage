// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";

import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer"; // ← こちらに戻す
import { ZoomArtworkProvider } from "@/components/shared/ZoomArtworkContext";
import ClientWrapper from "@/components/shared/ClientWrapper";
import ZoomArtworkDisplay from "@/components/shared/ZoomArtworkDisplay";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  title: "me-ish",
  description: "アートを、もっと近くに。",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="text-lg leading-relaxed font-zen text-[#333]">
        {/* Header は Client なら Suspense 配下に */}
        <Suspense fallback={null}>
          <Header />
        </Suspense>

        <ZoomArtworkProvider>
          <ClientWrapper>
            {children}
            <ZoomArtworkDisplay />
            <Analytics />
          </ClientWrapper>
        </ZoomArtworkProvider>

        {/* 共通レイアウトでは常にフッターを表示。
            /white と /float は各ルート専用 layout でヘッダー/フッターを置かない構成にしているため二重になりません。 */}
        <Footer />
      </body>
    </html>
  );
}
