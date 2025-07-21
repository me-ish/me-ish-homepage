'use client';

import dynamic from 'next/dynamic';

const TestGallery = dynamic(() => import('@/components/gallery/TestGallery').then(mod => mod.default), {
  ssr: false,
});

export default function Page() {
  return <TestGallery />;
}
