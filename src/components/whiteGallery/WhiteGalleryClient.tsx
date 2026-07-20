'use client';

import dynamic from 'next/dynamic';

const WhiteGallery = dynamic(
  () => import('./WhiteGallery').then((module) => module.default),
  { ssr: false }
);

export default function WhiteGalleryClient() {
  return <WhiteGallery />;
}
