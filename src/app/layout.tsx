// src/app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import QueryProvider from '@/components/providers/QueryProvider'; // ← 追加
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext';
import ClientWrapper from '@/components/shared/ClientWrapper';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import { Analytics } from '@/components/Analytics';

export const metadata: Metadata = {
  title: 'me-ish',
  description: 'アートを、もっと近くに。',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="text-lg leading-relaxed font-zen text-[#333]">
        {/* ここは全ページ共通。Header/Footer は置かない */}
        <Suspense fallback={null}>
          <QueryProvider> {/* ← ここで全体を包む */}
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
