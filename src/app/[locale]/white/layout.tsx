// src/app/white/layout.tsx
import type { Metadata } from 'next';
import { ZoomArtworkProvider } from '@/components/shared/ZoomArtworkContext';
import ZoomArtworkDisplay from '@/components/shared/ZoomArtworkDisplay';
import '@/app/globals.css';

export const metadata: Metadata = { title: 'me-ish' };

export default function WhiteLayout({ children }: { children: React.ReactNode }) {
  // ★ <html> / <body> は置かない（ルート layout だけが持つ）
  return (
    <ZoomArtworkProvider>
      {/* body に付けていたクラスはここに移す */}
      <div className="text-lg leading-relaxed font-zen text-[#333]">
        {children}
        <ZoomArtworkDisplay />
      </div>
    </ZoomArtworkProvider>
  );
}
