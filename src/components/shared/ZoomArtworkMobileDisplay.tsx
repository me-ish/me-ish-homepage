// src/components/shared/ZoomArtworkMobileDisplay.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Heart, ShoppingCart, Globe, Instagram, Infinity, Hash, Ban } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import type { Entry } from '../../types/types';

interface Props {
  artwork: Entry;
  onClose: () => void;
}

// UI 側で不足しがちなプロパティの受け口
type EntryUI = Entry & {
  image_url?: string; // snake
  imageUrl?: string;  // camel
  sns_links?: string | Record<string, string>;
};

export default function ZoomArtworkMobileDisplay({ artwork, onClose }: Props) {
  const a = artwork as EntryUI;

  const [likes, setLikes] = useState<number>((a as any).likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const editionTotal: number | null = (a as any).edition_total ?? null;
  const editionSold: number = (a as any).edition_sold ?? 0;
  const editionRemaining = editionTotal !== null ? editionTotal - editionSold : null;
  const isEditionSoldOut = editionTotal !== null && editionRemaining !== null && editionRemaining <= 0;

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
      const res = await fetch(`/api/entries/${(a as any).id}/like`, { method: 'POST', headers: { 'x-requested-with': 'me-ish' } });
      const json = await res.json();
      setLikes(json.likes ?? likes + 1);
      setLiked(true);
      localStorage.setItem(`liked_${(a as any).id}`, 'true');
    } catch {
      alert('いいねに失敗しました');
    }
    setTimeout(() => setIsAnimating(false), 250);
  };

  // snake / camel 両対応で安全に抽出
  const imageUrl = a.image_url ?? a.imageUrl ?? '';
  const title = (a as any).title ?? 'Untitled';
  const author = (a as any).author ?? 'Unknown';
  const description = (a as any).description ?? '';
  const price: number | null = (a as any).price ?? null;
  const is_for_sale: boolean = (a as any).is_for_sale ?? false;
  const is_sold: boolean = (a as any).is_sold ?? false;
  const created_at = (a as any).created_at ?? undefined;
  const id = (a as any).id ?? undefined;
  const ai_usage: 'none' | 'assist' | 'gen_assist' | null = (a as any).ai_usage ?? null;
  const ai_usage_scope: string[] | null = (a as any).ai_usage_scope ?? null;
  const ai_usage_note: string | null = (a as any).ai_usage_note ?? null;

  // SNSリンク：文字列JSON / オブジェクト 両対応
  let links: Record<string, string> = {};
  const snsRaw = a.sns_links ?? '{}';
  try {
    if (typeof snsRaw === 'string') links = JSON.parse(snsRaw);
    else if (typeof snsRaw === 'object') links = snsRaw as Record<string, string>;
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
    if (!id || !title || price == null) {
      alert('購入情報が不足しています');
      return;
    }
    const res = await fetch('/api/purchase/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-requested-with': 'me-ish' },
      body: JSON.stringify({ entryId: id, title, price: Number(price) }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert('Stripeへの遷移に失敗しました');
  };

  // --- Portal: 親ツリーから独立させて <a> の入れ子/Hydration を回避 ---
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const node = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] bg-black/90 text-white overflow-y-auto px-4 py-6 cursor-zoom-out"
      aria-modal="true"
      role="dialog"
    >
      {/* 閉じるボタン - 視認性向上 */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[10010] w-12 h-12 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/30 text-white hover:bg-black/80 hover:border-white/50 transition-all shadow-lg"
        aria-label="閉じる"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

        <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center space-y-6">
          {/* 画像枠（左上に Edition/非売品バッジを重ねる） */}
          <div className="relative inline-block max-w-[90vw] max-h-[70vh] bg-white rounded-xl shadow-lg p-3 select-none">
            {/* 左上バッジ */}
            <div className="absolute left-3 top-3 z-10">
              <EditionBadges isForSale={is_for_sale} editionTotal={editionTotal} />
            </div>

          <div
            aria-hidden
            className="absolute inset-0 z-[5] rounded-xl"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            onTouchStart={() => {}}
            style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
          />
          <Image
            src={imageUrl}
            alt={title}
            width={800}
            height={800}
            draggable={false}
            className="max-w-[90vw] max-h-[70vh] w-auto h-auto object-contain rounded-xl pointer-events-none select-none"
            style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
            unoptimized
          />
        </div>

        {/* タイトル等 */}
        <div className="w-full max-w-[90vw] text-center space-y-1">
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-sm text-gray-400">by {author}</p>
          <p className="text-xs text-gray-500">{formattedDate}</p>
        </div>

        {/* 価格/購入 */}
        <div className="w-full max-w-[90vw] flex flex-col items-center gap-3">
          {/* ⛔ 非売品：価格/残数/購入ボタン/注記は出さない */}
          {!is_for_sale ? (
            <div className="text-sm text-white/80">
              この作品は<strong>非売品</strong>です。販売・ダウンロードはできません。
            </div>
          ) : !is_sold ? (
            !isEditionSoldOut ? (
              <>
                {/* 💰 価格表示 */}
                <div className="text-lg font-bold text-[#00a1e9]">
                  {price != null ? `${Number(price).toLocaleString()}円（税込）` : '販売中'}
                </div>
                {/* 📦 残数表示（限定のみ） */}
                {editionTotal !== null && (
                  <div className="text-sm text-white/80">
                    残り {editionRemaining} / {editionTotal} 枚
                  </div>
                )}

                {/* ⚖️ 特商法注記（販売する時だけ） */}
                <LegalNotices />

                {/* 🛒 購入ボタン */}
                <button
                  onClick={handlePurchase}
                  className="flex items-center gap-2 bg-[#00a1e9] hover:bg-[#0090cc] text-white font-semibold py-2 px-5 rounded-xl shadow transition-all"
                >
                  <ShoppingCart size={20} />
                  購入する
                </button>
              </>
            ) : (
              <div className="text-gray-400 bg-gray-600 text-sm py-2 px-4 rounded-lg inline-block">SOLD</div>
            )
          ) : (
            <div className="text-gray-400 bg-gray-600 text-sm py-2 px-4 rounded-lg inline-block">SOLD</div>
          )}
        </div>

        {description && (
          <div className="max-w-[90vw] text-white/90 text-base leading-relaxed">{description}</div>
        )}

        <AiUsageSection usage={ai_usage} scope={ai_usage_scope} note={ai_usage_note} />

        {/* SNSリンク（外部リンクは <a> でOK。Portal化で親の <Link> と独立） */}
        {Object.keys(links).length > 0 && (
          <div className="space-y-2 pt-2 w-full max-w-[90vw]">
            {links.homepage && (
              <a
                href={links.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg"
              >
                <Globe size={18} />
                <span>ホームページ</span>
              </a>
            )}
            {links.twitter && (
              <a
                href={links.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg"
              >
                <FaXTwitter size={18} />
                <span>X（旧Twitter）</span>
              </a>
            )}
            {links.instagram && (
              <a
                href={links.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg"
              >
                <Instagram size={18} />
                <span>Instagram</span>
              </a>
            )}
          </div>
        )}

        {/* Like */}
        <div className="fixed bottom-5 right-5 z-50">
          <button
            onClick={handleLike}
            className="relative flex items-center gap-1 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full transition-all duration-300"
          >
            {isAnimating && <span className="absolute inset-0 rounded-full bg-pink-400 opacity-40 animate-ping" />}
            <Heart
              size={24}
              strokeWidth={2}
              className={`relative z-10 transition-all duration-300 ease-out ${
                liked ? 'text-pink-500 fill-pink-500 scale-110' : 'text-gray-400 scale-100'
              }`}
            />
            {liked && <span className="relative z-10 text-base font-semibold text-pink-400">{likes}</span>}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

/* ====== AI使用状況セクション ====== */

const AI_USAGE_SCOPE_LABELS: Record<string, string> = {
  background: '背景',
  props: '小物・装飾',
  inpaint: '部分補完・不要物除去',
  other: 'その他',
};

function AiUsageSection({
  usage,
  scope,
  note,
}: {
  usage: 'none' | 'assist' | 'gen_assist' | null;
  scope: string[] | null;
  note: string | null;
}) {
  if (!usage || usage === 'none') return null;

  const label =
    usage === 'assist'
      ? 'AI補助あり（構図・アイデア等）'
      : 'AI生成・補助あり';

  return (
    <div className="w-full max-w-[90vw] space-y-1.5 text-center">
      <div className="text-[11px] uppercase tracking-widest text-white/40">AI使用状況</div>
      <div className="inline-block rounded-full px-3 py-0.5 text-xs font-medium bg-violet-900/60 text-violet-200 ring-1 ring-violet-500/30">
        {label}
      </div>
      {usage === 'gen_assist' && scope && scope.length > 0 && (
        <div className="text-xs text-white/60">
          対象: {scope.map((s) => AI_USAGE_SCOPE_LABELS[s] ?? s).join('・')}
        </div>
      )}
      {usage === 'gen_assist' && note && (
        <div className="text-xs text-white/50 italic">{note}</div>
      )}
    </div>
  );
}

/* ====== ここから追加：Badges & Legal Notices ====== */

function EditionBadges({
  isForSale,
  editionTotal,
}: {
  isForSale: boolean;
  editionTotal: number | null;
}) {
  const isUnlimited = isForSale && editionTotal === null;
  const isLimited = isForSale && Number.isFinite(editionTotal as any);

  return (
    <div className="pointer-events-none flex flex-wrap gap-2">
      {!isForSale && (
        <Badge tone="muted" title="非売品" icon={<Ban className="h-3.5 w-3.5" />} />
      )}
      {isLimited && (
        <Badge
          tone="amber"
          title={typeof editionTotal === 'number' ? `限定 ${editionTotal} 枚` : '限定エディション'}
          icon={<Hash className="h-3.5 w-3.5" />}
        />
      )}
      {isUnlimited && (
        <Badge tone="cyan" title="無制限エディション" icon={<Infinity className="h-3.5 w-3.5" />} />
      )}
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
        'pointer-events-auto inline-flex items-center gap-1.5 rounded-full',
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

/** 特商法対応の購入前注記（価格近傍に表示） */
function LegalNotices() {
  return (
    <div className="mt-1 text-[11px] text-gray-300 leading-relaxed space-y-1 text-center">
      <p>※ 価格は<strong>税込・円表示（総額表示）</strong>です。</p>
      <p>※ 支払方法：クレジットカード（Stripe／日本円）。購入確定時に<strong>即時決済</strong>されます。</p>
      <p>※ 引渡時期：決済確認後、<strong>即時〜24時間以内</strong>に納品（障害時は最長<strong>3営業日</strong>）。</p>
      <p>
        <Link href="/footer/tokushoho" className="underline underline-offset-2">特定商取引法に基づく表記</Link>
        <span className="mx-1">／</span>
        <Link href="/footer/terms#sec-6" className="underline underline-offset-2">利用規約（展示・販売）</Link>
      </p>
    </div>
  );
}
