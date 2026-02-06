'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  resolveImageUrl,
  formatPrice,
  formatEdition,
  isSoldOut,
  type EntryRow,
} from '@/lib/gallery/galleryUtils';
import { isPlaceholder } from '@/lib/gallery/placeholder';

export interface ArtworkCardProps {
  entry: EntryRow;
  /** リンク先（デフォルトは /works/[id]） */
  href?: string;
  /** カードのサイズ variant */
  size?: 'sm' | 'md' | 'lg';
  /** 追加のクラス名 */
  className?: string;
}

export function ArtworkCard({
  entry,
  href,
  size = 'md',
  className,
}: ArtworkCardProps) {
  const placeholder = isPlaceholder(entry);
  const imageUrl = resolveImageUrl(entry);
  const sold = isSoldOut(entry);
  const priceText = formatPrice(entry.price);
  const editionText = formatEdition(entry.edition_total, entry.edition_sold);
  const linkHref = href ?? `/works/${entry.id}`;
  const [aspect, setAspect] = useState<'square' | 'portrait' | 'landscape' | null>(null);

  const sizeClasses = {
    sm: 'aspect-square',
    md: 'aspect-[4/5]',
    lg: 'aspect-[3/4]',
  };
  const aspectClass =
    aspect === 'square'
      ? 'aspect-square'
      : aspect === 'landscape'
        ? 'aspect-[5/4]'
        : aspect === 'portrait'
          ? 'aspect-[4/5]'
          : sizeClasses[size];

  const handleImageLoad = (img: HTMLImageElement) => {
    if (!img?.naturalWidth || !img?.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    let next: 'square' | 'portrait' | 'landscape';
    if (ratio >= 1.15) next = 'landscape';
    else if (ratio <= 0.87) next = 'portrait';
    else next = 'square';
    setAspect((prev) => (prev === next ? prev : next));
  };

  // プレースホルダーの場合は Coming Soon 表示
  if (placeholder) {
    return (
      <div className={cn('block', className)}>
        <Card className="overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 border-dashed border-2 border-gray-200">
          <div className={cn('relative', sizeClasses[size])}>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">Coming Soon</p>
              <p className="text-xs text-gray-300 mt-1">作品準備中</p>
            </div>
          </div>
          <CardContent className="p-3 bg-gray-50/50">
            <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-gray-100 rounded mt-2 animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Link href={linkHref} className={cn('block group', className)}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {/* Image Container */}
        <div className={cn('relative bg-gray-100', aspectClass)}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={entry.title || 'Artwork'}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              quality={75}
              loading="lazy"
              onLoadingComplete={handleImageLoad}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No Image
            </div>
          )}

          {/* SOLD Badge */}
          {sold && (
            <Badge
              variant="destructive"
              className="absolute top-2 right-2 bg-red-600"
            >
              SOLD
            </Badge>
          )}

          {/* Edition Badge */}
          {editionText && !sold && (
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 bg-black/70 text-white border-0"
            >
              {editionText}
            </Badge>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-3">
          {/* Title */}
          <h3 className="font-medium text-sm line-clamp-1 text-gray-900">
            {entry.title || 'Untitled'}
          </h3>

          {/* Artist */}
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {entry.artist_name || 'Unknown Artist'}
          </p>

          {/* Price */}
          {entry.is_for_sale && priceText && (
            <p className="text-sm font-semibold text-[#00a1e9] mt-1">
              {priceText}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
