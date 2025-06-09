'use client';

import React, { useEffect, useState } from 'react';
import { useZoomArtwork } from './ZoomArtworkContext';
import ZoomArtworkMobileDisplay from './ZoomArtworkMobileDisplay';
import ZoomArtworkDesktopDisplay from './ZoomArtworkDesktopDisplay';

export default function ZoomArtworkDisplay() {
  const { zoomedArtwork, setZoomedArtwork } = useZoomArtwork(); // ✅ ここで set を追加
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!zoomedArtwork) return null;

  return isMobile ? (
    <ZoomArtworkMobileDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />
  ) : (
    <ZoomArtworkDesktopDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />
  );
}
