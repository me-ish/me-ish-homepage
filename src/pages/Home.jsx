import React, { useEffect, useState } from 'react';
import MobileHome from './MobileHome';
import DesktopHome from './DesktopHome'; // ← あなたが今書いてるUIを移す先

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile ? <MobileHome /> : <DesktopHome />;
}
