'use client';

import React, { useEffect, useState } from 'react';
import MobileHome from '@/components/MobileHome';
import DesktopHome from '@/components/DesktopHome';

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    console.log('🧪 REACT VERSION (runtime):', React.version); // ← ここ！

    const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return <div>{isMobile ? <MobileHome /> : <DesktopHome />}</div>;
}
