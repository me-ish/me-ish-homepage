import type { Metadata } from 'next';
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext';
import ClientWrapper from '@/components/shared/ClientWrapper';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import { Analytics } from '@/components/Analytics';
import '@/app/globals.css';

export const metadata: Metadata = { title: 'me-ish' };

export default function WhiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="text-lg leading-relaxed font-zen text-[#333]">
        {/* Header/ Footer は置かない */}
        <ZoomArtworkProvider>
          <ClientWrapper>
            {children}
            <ZoomArtworkDisplay />
            <Analytics />
          </ClientWrapper>
        </ZoomArtworkProvider>
      </body>
    </html>
  );
}
