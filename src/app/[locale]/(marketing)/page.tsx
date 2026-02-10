// src/app/page.tsx (Server Componentのまま)
import { headers } from 'next/headers';
import MobileHome from '@/components/MobileHome';
import DesktopHome from '@/components/DesktopHome';

function isMobileUA(ua: string) {
  // ざっくり判定。必要ならTabletも分岐
  return /Android|iPhone|iPod|iPad|Mobile/i.test(ua);
}

export default function HomePage() {
  const ua = headers().get('user-agent') ?? '';
  const isMobile = isMobileUA(ua);

  return isMobile ? <MobileHome /> : <DesktopHome />;
}
