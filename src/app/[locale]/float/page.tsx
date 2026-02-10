import dynamic from 'next/dynamic';
import { getTodayDateString, isValidDateString } from '@/lib/gallery';

type FloatGalleryClientProps = {
  dateStr: string;
};

// default export を返す形にして型推論を安定化
const FloatGalleryClient = dynamic<FloatGalleryClientProps>(
  () => import('@/components/floatGallery/FloatGallery').then((m) => m.default),
  { ssr: false }
);

type PageProps = {
  searchParams?: { date?: string };
};

export default function FloatPage({ searchParams }: PageProps) {
  const raw = searchParams?.date ?? '';
  const dateStr = isValidDateString(raw) ? raw : getTodayDateString();

  return <FloatGalleryClient dateStr={dateStr} />;
}
