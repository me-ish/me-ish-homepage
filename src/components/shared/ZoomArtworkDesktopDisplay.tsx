// src/components/shared/ZoomArtworkDesktopDisplay.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  ShoppingCart,
  Globe,
  Instagram,
  Hash,
  Ban,
  Infinity as InfinityIcon, // グローバル Infinity と衝突回避
} from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import type { Entry } from '../../types/types';

interface Props {
  artwork: Entry;
  onClose: () => void;
}

// Entry に足りない可能性のあるプロパティの受け口
type EntryUI = Entry & {
  image_url?: string;
  imageUrl?: string;
  sns_links?: string | Record<string, string>;
  likes?: number;
  edition_total?: number | null;
  edition_sold?: number;
  is_for_sale?: boolean;
  is_sold?: boolean;
  editionMode?: 'limited' | 'unlimited';
};

export default function ZoomArtworkDesktopDisplay({ artwork, onClose }: Props) {
  const a = artwork as EntryUI;

  const [likes, setLikes] = useState<number>(a.likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 版数値
const editionTotal: number | null = a.edition_total ?? null;
const editionSold: number = a.edition_sold ?? 0;

  // フィールド抽出（snake/camel 両対応）
  const imageUrl = a.image_url ?? a.imageUrl ?? '';
  const title = (a as any).title ?? '';
  const author = (a as any).author ?? '';
  const description = (a as any).description ?? '';
  const price: number | null = (a as any).price ?? null;
  const is_for_sale: boolean = a.is_for_sale ?? false;
  const is_sold: boolean = a.is_sold ?? false;
  const id = (a as any).id ?? null;
  const created_at = (a as any).created_at ?? null;

// --- Edition 判定（edition_mode を最優先し、文字列は正規化） ---
const rawEditionMode = (a as any).edition_mode ?? (a as any).editionMode ?? null;
const normalizedMode =
  typeof rawEditionMode === 'string' ? rawEditionMode.trim().toLowerCase() : rawEditionMode;
const mode: 'limited' | 'unlimited' | null =
  normalizedMode === 'limited' || normalizedMode === 'unlimited' ? normalizedMode : null;

// edition_total を数値として安全に採用（それ以外は null）
const total =
  typeof editionTotal === 'number' && Number.isFinite(editionTotal) ? editionTotal : null;

// ★ データ確認ログ
console.log('DBG edition/raw', {
  id: (a as any).id,
  is_for_sale: a.is_for_sale,
  edition_mode_db: (a as any).edition_mode,
  editionMode_ui: (a as any).editionMode,
  normalizedMode,
  mode,
  edition_total_raw: a.edition_total,
  edition_total_sanitized: total,
  edition_sold: a.edition_sold,
});


// limited/unlimited を一意に決定（mode を最優先、なければ total>0）
const isLimited =
  (a.is_for_sale ?? false) && (mode === 'limited' || (mode == null && total !== null && total > 0));
const isUnlimited =
  (a.is_for_sale ?? false) && (mode === 'unlimited' || (mode == null && (total === null || total <= 0)));

// ★ 判定結果ログ（ここを追加）
console.log('DBG edition/judge', {
  id: (a as any).id,
  mode,
  total,
  isLimited,
  isUnlimited,
});


// 表示用の残数・総数（unlimited のときは必ず null に倒す）
const editionTotalForDisplay = isLimited ? total : null;
const editionRemainingForDisplay = isLimited && total != null ? (total - editionSold) : null;

// SOLD は限定時のみ有効
const isEditionSoldOut = isLimited && (editionRemainingForDisplay ?? 0) <= 0;

  // like 取得
  useEffect(() => {
    const fetchLikes = async () => {
      try {
        const res = await fetch(`/api/entries/${(a as any).id}/like`);
        const data = await res.json();
        setLikes(data.likes ?? 0);
      } catch (err) {
        console.error('❌ いいね数取得失敗:', err);
      }
    };
    const alreadyLiked = localStorage.getItem(`liked_${(a as any).id}`);
    setLiked(Boolean(alreadyLiked));
    fetchLikes();
  }, [(a as any).id]);

  const handleLike = async () => {
    if (liked) return;
    setIsAnimating(true);
    try {
      const res = await fetch(`/api/entries/${(a as any).id}/like`, { method: 'POST' });
      const data = await res.json();
      setLikes(data.likes ?? likes + 1);
      setLiked(true);
      localStorage.setItem(`liked_${(a as any).id}`, '1');
    } catch (err) {
      console.error('❌ いいね更新失敗:', err);
    } finally {
      setTimeout(() => setIsAnimating(false), 500);
    }
  };

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


  // SNS
  let links: Record<string, string> = {};
  try {
    const raw = a.sns_links ?? '{}';
    links = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, string>);
  } catch (e) {
    console.warn('SNSリンクのJSONパースに失敗:', e);
  }

  const formattedDate = created_at
    ? new Date(created_at).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '';

  // 下部固定バーの表示条件（非売品なら出さない）
  const showPurchaseBar = is_for_sale;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-start gap-8 p-6 rounded-2xl bg-white/5 border border-white/10 shadow-2xl max-w-[84vw] pb-24" // ← 下部バーの高さぶん余白
      >
        {/* 左：画像 */}
        <div className="flex flex-col">
          {/* 画像（サイズ控えめ） */}
          <div className="relative max-w-[32vw] max-h-[68vh]">
            {/* 左上バッジ（限定/無制限/非売品） */}
            <EditionBadges
              isForSale={is_for_sale}
              isLimited={isLimited}
              isUnlimited={isUnlimited}
            />
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-contain rounded-xl shadow-lg pointer-events-none select-none"
              draggable={false}
            />
          </div>

          {/* 非売品の説明（販売UIは下部バーに集約） */}
          {!is_for_sale && (
            <div className="mt-4 text-sm text-white/80">
              この作品は<strong>非売品</strong>です。販売・ダウンロードはできません。
            </div>
          )}
        </div>

        {/* 右：詳細 */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="ml-6 max-w-[26vw] relative min-h-[70vh] flex flex-col space-y-6 text-white px-2 cursor-default"
        >
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="text-sm text-gray-400">by {author}</p>

          <div className="text-sm text-gray-400 space-y-1">
            {id && <div>シリアル番号: #{String(id).padStart(3, '0')}</div>}
            <div>登録日: {formattedDate}</div>
          </div>

          {description && <p className="text-base leading-relaxed text-white/90">{description}</p>}

          {/* SNSリンク（新規タブで開く） */}
          {Object.keys(links).length > 0 && (
            <div className="space-y-2 pt-2">
              {links.homepage && (
                <a
                  href={links.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition"
                >
                  <Globe size={18} />
                  ホームページ
                </a>
              )}
              {links.twitter && (
                <a
                  href={links.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition"
                >
                  <FaXTwitter />
                  X（Twitter）
                </a>
              )}
              {links.instagram && (
                <a
                  href={links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition"
                >
                  <Instagram size={18} />
                  Instagram
                </a>
              )}
            </div>
          )}

          {/* Like */}
          <div className="absolute bottom-0 right-3 z-10 mb-2">
            <button
              onClick={handleLike}
              className="relative flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/15 text-white backdrop-blur-sm rounded-full transition-all duration-300"
            >
              {isAnimating && <span className="absolute inset-0 rounded-full bg-pink-400 opacity-40 animate-ping" />}
              <Heart
                size={24}
                strokeWidth={2}
                className={`relative z-10 transition-all duration-300 ease-out ${
                  liked ? 'text-pink-500 fill-pink-500' : 'text-white'
                }`}
              />
              <span className="text-sm">{likes}</span>
            </button>
          </div>
        </div>
      </div>

      {/* === 下部固定の購入バー（購入導線と特商法ミニ注記を集約） === */}
      {showPurchaseBar && (
        <DesktopPurchaseBar
          isLimited={isLimited}
          isSold={is_sold}
          isEditionSoldOut={isEditionSoldOut}
          price={price ?? null}
          editionTotal={editionTotalForDisplay}
          editionRemaining={editionRemainingForDisplay}
          entryId={id}
          title={title}
          onPurchase={handlePurchase}
        />
      )}
    </div>,
    document.body
  );
}

/* ===== 付加：バッジ＆固定購入バー＆特商法ミニ注記 ===== */

function EditionBadges({
  isForSale,
  isLimited,
  isUnlimited,
}: {
  isForSale: boolean;
  isLimited: boolean;
  isUnlimited: boolean;
}) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
      {!isForSale && <Badge tone="muted" title="非売品" />}
      {isLimited   && <Badge tone="amber" title="edition" />}
      {isUnlimited && <Badge tone="cyan"  title="unlimited" />}
    </div>
  );
}


function Badge({
  title,
  icon,
  tone = 'muted',
}: {
  title: string;
  icon?: React.ReactNode;
  tone?: 'muted' | 'cyan' | 'amber';
}) {
  const toneCls =
    tone === 'cyan'
      ? 'bg-cyan-50 text-cyan-700 ring-cyan-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-gray-50 text-gray-700 ring-gray-200';

  return (
    <div
      className={[
        'inline-flex items-center gap-1.5 rounded-full',
        'px-2.5 py-1 text-[11px] font-medium tracking-wide',
        'backdrop-blur-sm ring-1 shadow-sm',
        toneCls,
      ].join(' ')}
      aria-label={title}
    >
      {icon}
      <span>{title}</span>
    </div>
  );
}

type PurchaseBarProps = {
  isLimited: boolean;
  isSold: boolean;
  isEditionSoldOut: boolean;
  price: number | null;
  editionTotal: number | null;
  editionRemaining: number | null;
  entryId?: number | string | null;
  title: string;
  onPurchase?: () => void;
};

function DesktopPurchaseBar({
  isLimited,
  isSold,
  isEditionSoldOut,
  price,
  editionTotal,
  editionRemaining,
  entryId,
  title,
  onPurchase,
}: PurchaseBarProps) {
  const disabled = isSold || isEditionSoldOut || price == null;

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[1020] bg-black/90 backdrop-blur border-t border-white/10">
      <div className="mx-auto max-w-[1200px] px-6 py-3 flex items-center justify-between gap-6">
        {/* 左：価格＆在庫 */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[22px] font-extrabold text-white tracking-wide">
              {price != null ? `${Number(price).toLocaleString()}円` : '価格未設定'}
            </div>
            <span className="text-[12px] px-2 py-0.5 rounded bg-white/10 text-white/80">税込</span>
            {(isSold || isEditionSoldOut) && (
              <span className="text-[12px] px-2 py-0.5 rounded bg-gray-700 text-gray-200">SOLD</span>
            )}
          </div>

          {/* 限定のときだけ残数表示（無制限や完売時は非表示） */}
          {isLimited && !isEditionSoldOut && (
            <div className="mt-1 text-sm text-white/80">
              残り {editionRemaining} / {editionTotal} 枚
            </div>
          )}

          {/* 特商法ミニ注記（リンクは新規タブ） */}
          <div className="mt-1 text-[12px] text-white/70 space-x-3">
            <span>支払：カード（Stripe）即時決済</span>
            <span>引渡：即時〜24h（障害時最長3営業日）</span>
            <span>返品：原則不可</span>
            <a
              href="/footer/tokushoho"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              特商法
            </a>
            <span>/</span>
            <a
              href="/footer/terms#sec-6"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              利用規約
            </a>
          </div>
        </div>

        {/* 右：購入ボタン */}
        <div className="flex-shrink-0">
          <button
            onClick={onPurchase}
            disabled={disabled}
            aria-disabled={disabled}
            className={[
              'flex items-center gap-2 h-11 px-6 rounded-xl font-semibold shadow',
              disabled
                ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                : 'bg-[#00a1e9] hover:bg-[#0090cc] text-white',
            ].join(' ')}
          >
            <ShoppingCart size={20} />
            {disabled ? 'SOLD' : '購入する'}
          </button>
        </div>
      </div>
    </div>
  );
}
