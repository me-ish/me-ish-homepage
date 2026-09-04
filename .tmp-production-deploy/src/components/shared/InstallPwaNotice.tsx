'use client';

import { useEffect, useState } from 'react';

export default function InstallPwaNotice() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isMobile =
      /iphone|ipad|ipod|android/.test(ua) &&
      !/windows|macintosh|linux/.test(ua); // PCとの判別も強化


    if (isMobile) setShouldShow(true);
  }, []);

  if (!shouldShow) return null;

  return (
    <div className="mx-auto mt-6 max-w-[640px] bg-[#e6f7fc] text-[#006a8e] px-5 py-4 text-sm text-center shadow-sm border border-[#b3e5fc] rounded-xl">
      <p className="mb-2 font-semibold text-base leading-relaxed">
        📱 スマートフォンからは<br className="sm:hidden" />
        <span className="underline underline-offset-2 font-bold">「ホーム画面に追加」</span>
        すると全画面でお楽しみいただけます！
      </p>
      <p className="text-xs leading-relaxed">
        ・iPhone：共有 → ホーム画面に追加<br />
        ・Android：メニュー → ホーム画面に追加
      </p>
    </div>
  );
}
