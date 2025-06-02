import './globals.css';
import React from 'react';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext';
import ClientWrapper from '@/components/shared/ClientWrapper';

export const metadata = {
  title: 'me-ish',
  description: '誰でも参加できる3Dアートギャラリー',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="relative min-h-screen text-[#333] font-zen overflow-x-hidden">
        <ZoomArtworkProvider>
          <ClientWrapper>
            {children}
            <ZoomArtworkDisplay />
          </ClientWrapper>
        </ZoomArtworkProvider>
      </body>
    </html>
  );
}
