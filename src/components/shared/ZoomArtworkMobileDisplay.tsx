'use client';

import React, { useEffect, useState } from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import NftPurchaseButton from '@/components/purchase/NftPurchaseButton';
import { Entry } from '../../types/types'; // 型が未定義なら any でも可

interface Props {
  artwork: Entry;
  onClose: () => void;
}

export default function ZoomArtworkMobileDisplay({ artwork, onClose }: Props) {
  const [likes, setLikes] = useState<number>(artwork.likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const fetchLikes = async () => {
      try {
        const res = await fetch(`/api/entries/${artwork.id}/like`);
        const data = await res.json();
        setLikes(data.likes ?? 0);
      } catch (err) {
        console.error('❌ いいね数取得失敗:', err);
      }
    };

    const alreadyLiked = localStorage.getItem(`liked_${artwork.id}`);
    setLiked(Boolean(alreadyLiked));

    fetchLikes();
  }, [artwork.id]);

  const handleLike = async () => {
    if (liked) return;
    setIsAnimating(true);

    try {
      const res = await fetch(`/api/entries/${artwork.id}/like`, { method: 'POST' });
      const json = await res.json();
      setLikes(json.likes);
      setLiked(true);
      localStorage.setItem(`liked_${artwork.id}`, 'true');
    } catch (err) {
      alert('いいねに失敗しました');
    }

    setTimeout(() => setIsAnimating(false), 250);
  };

  const {
    imageUrl,
    title = 'Untitled',
    author = 'Unknown',
    description = '',
    price,
    is_for_sale,
    is_sold,
    sns_links = '{}',
    created_at,
    sale_type = 'normal',
    token_id,
  } = artwork;

  let links: Record<string, string> = {};
  try {
    links = JSON.parse(sns_links);
  } catch (e) {
    console.error('SNSリンクのパースに失敗:', e);
  }

  const formattedDate = created_at
    ? new Date(created_at).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '登録日不明';

  const handlePurchase = async () => {
    if (!artwork.id || !title || !price) {
      alert('購入情報が不足しています');
      return;
    }

    const res = await fetch('/api/purchase/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: artwork.id, title, price: Number(price) }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Stripeへの遷移に失敗しました');
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[1000] bg-black/90 text-white overflow-y-auto px-4 py-6 cursor-zoom-out">
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center space-y-6">

        <div className={`self-end mb-2 px-3 py-1 rounded-full text-xs font-semibold shadow-md ${
          sale_type === 'nft'
            ? 'bg-gradient-to-r from-violet-400 to-purple-600 text-white'
            : 'bg-gray-600 text-white'
        }`}>
          {sale_type === 'nft' ? 'NFT作品' : '通常販売作品'}
        </div>

        <div className="w-full max-w-[90vw] bg-white rounded-xl shadow-lg p-3">
          <img src={imageUrl} alt={title} className="w-full h-auto object-contain rounded-lg" />
        </div>

        <div className="w-full max-w-[90vw] text-center space-y-1">
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-gray-400">by {author}</p>
          <p className="text-xs text-gray-500">{formattedDate}</p>
        </div>

        <div className="w-full max-w-[90vw] flex justify-center items-center gap-3 flex-wrap">
          {is_for_sale && !is_sold ? (
            <>
              <div className="text-lg font-bold text-[#00a1e9]">
                {price ? `${Number(price).toLocaleString()}円（税込）` : '販売中'}
              </div>
              {sale_type === 'nft' && token_id ? (
                <NftPurchaseButton
                  entryId={artwork.id}
                  title={title}
                  price={Number(price)}
                  tokenId={token_id}
                />
              ) : (
                <button
                  onClick={handlePurchase}
                  className="flex items-center gap-2 bg-[#00a1e9] hover:bg-[#0090cc] text-white font-semibold py-2 px-5 rounded-xl shadow transition-all"
                >
                  <ShoppingCart size={20} />
                  購入する
                </button>
              )}
            </>
          ) : (
            <div className="text-gray-400 bg-gray-600 text-sm py-2 px-4 rounded-lg inline-block">
              SOLD
            </div>
          )}
        </div>

        {description && (
          <div className="max-w-[90vw] text-white/90 text-base leading-relaxed">
            {description}
          </div>
        )}

        {Object.keys(links).length > 0 && (
          <div className="space-y-2 pt-2 max-w-[90vw] w-full">
            {links.homepage && (
              <a href={links.homepage} target="_blank" rel="noopener noreferrer"
                className="block bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-center">
                🔗 ホームページ
              </a>
            )}
            {links.twitter && (
              <a href={links.twitter} target="_blank" rel="noopener noreferrer"
                className="block bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-center">
                🌟 X（旧Twitter）
              </a>
            )}
            {links.instagram && (
              <a href={links.instagram} target="_blank" rel="noopener noreferrer"
                className="block bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-center">
                📸 Instagram
              </a>
            )}
          </div>
        )}

        <div className="fixed bottom-5 right-5 z-50">
          <button
            onClick={handleLike}
            className="relative flex items-center gap-1 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full transition-all duration-300"
          >
            {isAnimating && (
              <span className="absolute inset-0 rounded-full bg-pink-400 opacity-40 animate-ping" />
            )}
            <Heart
              size={24}
              strokeWidth={2}
              className={`relative z-10 transition-all duration-300 ease-out ${
                liked
                  ? 'text-pink-500 fill-pink-500 scale-110'
                  : 'text-gray-400 scale-100'
              }`}
            />
            {liked && (
              <span className="relative z-10 text-base font-semibold text-pink-400">
                {likes}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

