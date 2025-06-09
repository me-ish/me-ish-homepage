'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useZoomArtwork } from './ZoomArtworkContext';

// 遅延読み込み（不要なら普通のimportでもOK）
const ZoomArtworkDesktopDisplay = dynamic(() => import('./ZoomArtworkDesktopDisplay'));
const ZoomArtworkMobileDisplay = dynamic(() => import('./ZoomArtworkMobileDisplay'));

export default function ZoomArtworkDisplay() {
  const { zoomedArtwork } = useZoomArtwork();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!zoomedArtwork) return null;

  return isMobile
    ? <ZoomArtworkMobileDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />
    : <ZoomArtworkDesktopDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />;
}
