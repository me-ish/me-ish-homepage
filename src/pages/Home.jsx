import React, { useEffect, useState } from 'react';
import MobileHome from './MobileHome';
import DesktopHome from './DesktopHome'; 

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className={isMobile ? "mobile-home" : "desktop-home"}>
      {isMobile ? <MobileHome /> : <DesktopHome />}
    </div>
  );
}

