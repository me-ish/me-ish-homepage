import './globals.css'
import React from 'react'
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay'
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext'
import ClientWrapper from '@/components/shared/ClientWrapper'
import { Analytics } from '@/components/Analytics'

export const metadata = {
  title: 'me-ish',
  description: 'アートを、もっと近くに。',
  manifest: '/manifest.json',
  themeColor: '#00a1e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="relative min-h-screen text-[#333] font-zen overflow-x-hidden max-w-[820px] mx-auto px-4">
        <ZoomArtworkProvider>
          <ClientWrapper>
            {children}
            <ZoomArtworkDisplay />
            <Analytics />
          </ClientWrapper>
        </ZoomArtworkProvider>
      </body>
    </html>
  )
}

