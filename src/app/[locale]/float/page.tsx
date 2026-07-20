import { getTodayDateString, isValidDateString } from '@/lib/gallery';
import FloatGalleryClient from '@/components/floatGallery/FloatGalleryClient';

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

export default async function FloatPage({ searchParams }: PageProps) {
  const raw = (await searchParams)?.date ?? '';
  const dateStr = isValidDateString(raw) ? raw : getTodayDateString();

  return <FloatGalleryClient dateStr={dateStr} />;
}
