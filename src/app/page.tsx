'use client';

import React, { useEffect, useState } from 'react';
import MobileHome from '@/components/MobileHome';
import DesktopHome from '@/components/DesktopHome';

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);
  const [isPwa, setIsPwa] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    const currentPath = window.location.pathname;
    const preferred = localStorage.getItem('preferredGallery');

    if (isStandalone && currentPath === '/') {
      setIsPwa(true);
      if (preferred) {
        window.location.href = `/${preferred}-install`;
      } else {
        setShowSelector(true);
      }
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSelect = (gallery: 'white' | 'float') => {
    localStorage.setItem('preferredGallery', gallery);
    window.location.href = `/${gallery}-install`;
  };

  if (showSelector) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white text-center font-zen text-[#333] px-5">
        <h1 className="text-3xl mb-6 font-bold text-[#00a1e9]">ギャラリーを選択してください</h1>
        <p className="text-sm mb-10 text-[#555]">
          初回のみ選択が必要です。次回以降はこの選択に従って起動します。
        </p>
        <button
          onClick={() => handleSelect('white')}
          className="mb-4 px-6 py-3 bg-[#00a1e9] text-white rounded-lg text-lg"
        >
          White Gallery を開く
        </button>
        <button
          onClick={() => handleSelect('float')}
          className="px-6 py-3 bg-[#00a1e9] text-white rounded-lg text-lg"
        >
          Float Gallery を開く
        </button>
      </div>
    );
  }

  return <div>{isMobile ? <MobileHome /> : <DesktopHome />}</div>;
}
