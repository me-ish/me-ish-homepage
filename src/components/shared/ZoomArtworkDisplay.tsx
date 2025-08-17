'use client';

import React, { useEffect, useState } from 'react';
import { useZoomArtwork } from './ZoomArtworkContext';
import ZoomArtworkMobileDisplay from './ZoomArtworkMobileDisplay';
import ZoomArtworkDesktopDisplay from './ZoomArtworkDesktopDisplay';

export default function ZoomArtworkDisplay() {
  const { zoomedArtwork, setZoomedArtwork } = useZoomArtwork();
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false); // ← 追加

  useEffect(() => {
    setMounted(true); // ← 追加（SSR/CSRの不一致を防ぐ）
    const check = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 初回SSRとの差分をなくすため、マウント前は描画しない
  if (!mounted || !zoomedArtwork) return null;

  return isMobile ? (
    <ZoomArtworkMobileDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />
  ) : (
    <ZoomArtworkDesktopDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />
  );
}
