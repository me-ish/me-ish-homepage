'use client';

import { useEffect, useState } from 'react';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    console.log('✅ useIsMobile 発火');
    const check = () => {
      console.log('📏 window.innerWidth:', window.innerWidth);
      setIsMobile(window.innerWidth < 1024);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
