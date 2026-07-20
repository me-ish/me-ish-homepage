'use client';

import dynamic from 'next/dynamic';

type FloatGalleryClientProps = {
  dateStr: string;
};

const FloatGallery = dynamic(
  () => import('./FloatGallery').then((module) => module.default),
  { ssr: false }
);

export default function FloatGalleryClient({ dateStr }: FloatGalleryClientProps) {
  return <FloatGallery dateStr={dateStr} />;
}
