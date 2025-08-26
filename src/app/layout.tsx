import './globals.css'
import React from 'react'
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay'
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext'
import ClientWrapper from '@/components/shared/ClientWrapper'
import { Analytics } from '@/components/Analytics'
import { Suspense } from 'react'
import Header from '@/components/shared/Header'
import Footer from '@/components/shared/Footer'

export const metadata = {
  title: 'me-ish',
  description: 'アートを、もっと近くに。',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
<body className="text-lg leading-relaxed font-zen text-[#333]">
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
        <Footer />
      </body>
    </html>
  )
}

