'use client';

import React, { useEffect, useState } from 'react';
import { useZoomArtwork } from './ZoomArtworkContext';
import ZoomArtworkMobileDisplay from './ZoomArtworkMobileDisplay';
import ZoomArtworkDesktopDisplay from './ZoomArtworkDesktopDisplay';

export default function ZoomArtworkDisplay() {
  const { zoomedArtwork, setZoomedArtwork } = useZoomArtwork();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);

    const query = '(max-width: 767px)';
    const mql = typeof window !== 'undefined' ? window.matchMedia(query) : null;

    const onChange = () => setIsMobile(mql ? mql.matches : null);
    onChange(); // 初回判定
    mql?.addEventListener('change', onChange);

    return () => mql?.removeEventListener('change', onChange);
  }, []);

  // SSRとの差分を無くす：マウント前 or 画面幅未判定 or 作品なし → 何も描かない
  if (!mounted || isMobile === null || !zoomedArtwork) return null;

  return isMobile ? (
    <ZoomArtworkMobileDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />
  ) : (
    <ZoomArtworkDesktopDisplay artwork={zoomedArtwork} onClose={() => setZoomedArtwork(null)} />
  );
}

