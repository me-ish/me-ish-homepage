// src/app/mypage/portfolio/_components/WorkVisibilityCard.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Heart, Eye, EyeOff, ShoppingBag, ExternalLink } from 'lucide-react';
import type { EntryWithStatus } from '@/lib/portfolio/types';

type Props = {
  entry: EntryWithStatus;
  onToggle: () => void;
};

export function WorkVisibilityCard({ entry, onToggle }: Props) {
  const imageUrl = entry.image_url || '/placeholder.png';
  const isHidden = entry.portfolio_hidden ?? false;
  const isDisplaying = entry.display_ready;
  const isForSale = entry.is_for_sale;

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-xl border transition ${
        isHidden
          ? 'bg-gray-50 border-gray-200 opacity-70'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* サムネイル */}
      <Link href={`/works/${entry.id}`} className="flex-shrink-0">
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-100">
          <Image
            src={imageUrl}
            alt={entry.title || 'Artwork'}
            fill
            className={`object-cover ${isHidden ? 'grayscale' : ''}`}
            sizes="64px"
          />
        </div>
      </Link>

      {/* 作品情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/works/${entry.id}`}
            className="font-medium text-gray-900 hover:text-[#00a1e9] transition-colors line-clamp-1"
          >
            {entry.title || 'Untitled'}
          </Link>
          <a
            href={`/works/${entry.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-gray-400 hover:text-gray-600"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {isDisplaying && (
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
              展示中
            </Badge>
          )}
          {isForSale && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
              <ShoppingBag className="h-3 w-3 mr-1" />
              販売中
            </Badge>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Heart className="h-3 w-3 text-pink-500" />
            {entry.likes}
          </span>
        </div>
      </div>

      {/* 表示トグル */}
      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            isHidden
              ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              : 'bg-[#00a1e9]/10 text-[#007bb3] hover:bg-[#00a1e9]/20'
          }`}
        >
          {isHidden ? (
            <>
              <EyeOff className="h-4 w-4" />
              <span className="hidden sm:inline">非表示</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">表示中</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
