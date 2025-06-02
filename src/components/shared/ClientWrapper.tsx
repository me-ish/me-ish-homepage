'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/shared/Footer';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isGallery = pathname === '/white' || pathname === '/float';

  return (
    <>
      {children}
      {!isGallery && <Footer />}
    </>
  );
}
