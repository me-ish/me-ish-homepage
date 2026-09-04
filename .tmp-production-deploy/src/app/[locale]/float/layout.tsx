import type { Metadata } from 'next';
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext';
import ClientWrapper from '@/components/shared/ClientWrapper';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import { Analytics } from '@/components/Analytics';

// nested layout なので <html> / <body> は置かない
export const metadata: Metadata = { title: 'me-ish' };

export default function FloatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZoomArtworkProvider>
      <ClientWrapper>
        {children}
        <ZoomArtworkDisplay />
        <Analytics />
      </ClientWrapper>
    </ZoomArtworkProvider>
  );
}
