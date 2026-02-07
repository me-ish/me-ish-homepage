'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Heart, ShoppingCart } from 'lucide-react';
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
  const [likes, setLikes] = useState<number>(entry.likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alreadyLiked = localStorage.getItem(`liked_${entry.id}`);
    if (alreadyLiked) setLiked(true);
  }, [entry.id]);

  const handleLike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (liked || likeBusy) return;

    setLikeBusy(true);
    setLiked(true);
    setLikes((prev) => prev + 1);

    try {
      const res = await fetch(`/api/entries/${entry.id}/like`, { method: 'POST' });
      const data = await res.json();
      if (typeof data.likes === 'number') {
        setLikes(data.likes);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(`liked_${entry.id}`, '1');
      }
    } catch {
      setLiked(false);
      setLikes((prev) => Math.max(0, prev - 1));
    } finally {
      setLikeBusy(false);
    }
  };

  const handlePurchase = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!entry.is_for_sale || sold || purchaseBusy) return;

    setPurchaseBusy(true);
    try {
      const res = await fetch('/api/purchase/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: String(entry.id) }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }
      alert(data?.error || '購入手続きの開始に失敗しました。');
    } catch {
      alert('購入手続きの開始に失敗しました。');
    } finally {
      setPurchaseBusy(false);
    }
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
              className="object-cover transition-transform group-hover:scale-105 pointer-events-none select-none"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              quality={75}
              loading="lazy"
              draggable={false}
              onLoadingComplete={handleImageLoad}
              onContextMenu={(e) => e.preventDefault()}
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

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleLike}
              className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-pink-600"
              aria-pressed={liked}
              disabled={likeBusy}
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  liked ? 'text-pink-500 fill-pink-500' : 'text-gray-400'
                )}
              />
              <span>{likes}</span>
            </button>

            {entry.is_for_sale && !sold && (
              <button
                type="button"
                onClick={handlePurchase}
                className="inline-flex items-center gap-1 rounded-full bg-[#00a1e9] px-3 py-1 text-xs font-medium text-white hover:brightness-105 disabled:opacity-60"
                disabled={purchaseBusy}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {purchaseBusy ? '処理中...' : '購入する'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
