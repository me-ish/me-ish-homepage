'use client';

import React, { useEffect, useState } from 'react';
import { useZoomArtwork } from './ZoomArtworkContext';
import NftPurchaseButton from '@/components/purchase/NftPurchaseButton';
import { Heart, ShoppingCart } from 'lucide-react';

export default function ZoomArtworkDisplay() {
  const { zoomedArtwork, setZoomedArtwork } = useZoomArtwork();

  const [likes, setLikes] = useState<number>(zoomedArtwork?.likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!zoomedArtwork?.id) return;

    const fetchLikes = async () => {
      try {
        const res = await fetch(`/api/entries/${zoomedArtwork.id}/like`);
        const data = await res.json();
        setLikes(data.likes ?? 0);
      } catch (err) {
        console.error('❌ いいね数取得失敗:', err);
      }
    };

    const alreadyLiked = localStorage.getItem(`liked_${zoomedArtwork.id}`);
    setLiked(Boolean(alreadyLiked));

    fetchLikes();
  }, [zoomedArtwork]);

  const handleLike = async () => {
    if (liked || !zoomedArtwork?.id) return;
    setIsAnimating(true);

    try {
      const res = await fetch(`/api/entries/${zoomedArtwork.id}/like`, { method: 'POST' });
      const json = await res.json();
      setLikes(json.likes);
      setLiked(true);
      localStorage.setItem(`liked_${zoomedArtwork.id}`, 'true');
    } catch (err) {
      alert('fetchに失敗しました');
    }

    setTimeout(() => setIsAnimating(false), 250);
  };

  if (!zoomedArtwork || !zoomedArtwork.imageUrl) return null;

  const {
    imageUrl,
    title = 'Untitled',
    author = 'Unknown',
    description = '',
    price = null,
    is_for_sale = false,
    is_sold = false,
    sns_links = '{}',
    id = null,
    created_at = null,
    sale_type = 'normal',
    token_id = null,
  } = zoomedArtwork;

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
    if (!id || !title || !price) {
      alert('購入情報が不足しています');
      return;
    }

    const res = await fetch('/api/purchase/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: id, title, price: Number(price) }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Stripeへの遷移に失敗しました');
    }
  };

  return (
    <div
      onClick={() => setZoomedArtwork(null)}
      className="fixed inset-0 z-[1000] bg-black/90 text-white flex items-center justify-center px-6 py-10 overflow-y-auto cursor-zoom-out"
    >
      {/* 左側：画像 + 購入UI */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center"
      >
        {/* 白背景エリア */}
        <div className="relative w-[45vw] h-[80vh] bg-white rounded-2xl shadow-lg flex items-center justify-center">
          {/* バッジ */}
          <div
            className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold shadow-md z-10 ${
              sale_type === 'nft'
                ? 'bg-gradient-to-r from-violet-400 to-purple-600 text-white'
                : 'bg-gray-600 text-white'
            }`}
          >
            {sale_type === 'nft' ? 'NFT作品' : '通常販売作品'}
          </div>

          {/* 画像 */}
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>

        {/* 購入UI */}
        <div className="mt-4 flex flex-wrap justify-center items-center gap-4">
          {is_for_sale && !is_sold ? (
            <>
              <div className="text-xl font-bold text-[#00a1e9]">
                {price ? `${Number(price).toLocaleString()}円（税込）` : '販売中'}
              </div>
              {sale_type === 'nft' && token_id ? (
                <NftPurchaseButton
                  entryId={id!}
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
      </div>

      {/* 右側：情報パネル（relativeでいいねボタン固定） */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="ml-10 max-w-[24vw] relative min-h-[80vh] flex flex-col space-y-6 text-white px-4 cursor-default"
      >
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="text-sm text-gray-400">by {author}</p>

        <div className="text-sm text-gray-400 space-y-1">
          {id && <div>シリアル番号: #{String(id).padStart(3, '0')}</div>}
          <div>登録日: {formattedDate}</div>
        </div>

        {description && (
          <p className="text-base leading-relaxed text-white/90">{description}</p>
        )}

        {/* SNSリンク */}
        {Object.keys(links).length > 0 && (
          <div className="space-y-2 pt-2">
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

{/* ❤️ 右下に固定配置（Tailwindアニメ付き） */}
<div className="absolute bottom-6 right3 z-10">
  <button
    onClick={handleLike}
    className="relative flex items-center gap-1 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full transition-all duration-300"
  >
    {/* バーストエフェクト */}
    {isAnimating && (
      <span className="absolute inset-0 rounded-full bg-pink-400 opacity-40 animate-ping" />
    )}

    {/* ハートアイコン本体 */}
    <Heart
      size={24}
      strokeWidth={2}
      className={`relative z-10 transition-all duration-300 ease-out ${
        liked
          ? 'text-pink-500 fill-pink-500 scale-110'
          : 'text-gray-400 scale-100'
      }`}
    />

    {/* いいね数（liked時のみ） */}
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
