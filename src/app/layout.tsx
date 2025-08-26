// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";

import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
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
        {/* usePathname/useSearchParams を使う可能性があるので Header は必ず Suspense 配下 */}
        <Suspense fallback={null}>
          <Header />
        </Suspense>

        {/* ★ ここを丸ごと Suspense で包む（ZoomArtworkDisplay/Analytics が原因でも確実に解決） */}
        <Suspense fallback={null}>
          <ZoomArtworkProvider>
            <ClientWrapper>
              {children}
              <ZoomArtworkDisplay />
              <Analytics />
            </ClientWrapper>
          </ZoomArtworkProvider>
        </Suspense>

        <Footer />
      </body>
    </html>
  );
}
