import type { Metadata } from 'next';
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';

// nested layout なので <html> / <body> は置かない
export const metadata: Metadata = { title: 'me-ish' };

export default function FloatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZoomArtworkProvider>
      {children}
      <ZoomArtworkDisplay />
    </ZoomArtworkProvider>
  );
}
