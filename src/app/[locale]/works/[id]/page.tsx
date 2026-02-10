'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, Instagram } from 'lucide-react';
import { FaXTwitter } from 'react-icons/fa6';
import {
  resolveImageUrl,
  formatPrice,
  formatEdition,
  isSoldOut,
  parseSnsLinks,
  type EntryRow,
} from '@/lib/gallery/galleryUtils';
import { CommentSection } from '@/components/comments';

/** 作品詳細に必要なカラム */
const WORK_DETAIL_COLUMNS = `
  id, title, artist_name, description, image_url, file_name,
  is_for_sale, price, sale_type, sns_links, gallery_type, likes,
  is_sold, edition_total, edition_sold, confirmed, display_ready, user_id
`.replace(/\s+/g, '');

// セッションIDを取得または生成
function getOrCreateSessionId(): string {
  const key = 'meish_session_id';
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export default function WorkDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<EntryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewRecorded = useRef(false);

  // 閲覧イベントを記録
  useEffect(() => {
    if (!id || isNaN(Number(id)) || viewRecorded.current) return;

    const recordView = async () => {
      viewRecorded.current = true;
      try {
        const sessionId = getOrCreateSessionId();
        const { data: { user } } = await supabase.auth.getUser();

        await fetch(`/api/entries/${id}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: user?.id || null,
          }),
        });
      } catch (e) {
        // 閲覧記録の失敗はサイレントに無視
      }
    };

    recordView();
  }, [id]);

  useEffect(() => {
    const fetchEntry = async () => {
      if (!id || isNaN(Number(id))) {
        setError('Invalid work ID');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('entries')
        .select(WORK_DETAIL_COLUMNS)
        .eq('id', Number(id))
        .eq('confirmed', true)
        .eq('display_ready', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('作品が見つかりません');
        } else {
          console.error('Entry fetch error:', fetchError);
          setError(fetchError.message);
        }
        setLoading(false);
        return;
      }

      setEntry(data as unknown as EntryRow);
      setLoading(false);
    };

    fetchEntry();
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Error state
  if (error || !entry) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          {error || '作品が見つかりません'}
        </h1>
        <Link href="/float/2d">
          <Button>ギャラリーに戻る</Button>
        </Link>
      </div>
    );
  }

  const imageUrl = resolveImageUrl(entry);
  const sold = isSoldOut(entry);
  const priceText = formatPrice(entry.price);
  const editionText = formatEdition(entry.edition_total, entry.edition_sold);
  const snsLinks = parseSnsLinks(entry.sns_links);
  const galleryType = entry.gallery_type || 'float';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link
            href={`/${galleryType}/2d`}
            className="text-sm text-[#00a1e9] hover:underline"
          >
            ← ギャラリーに戻る
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="relative aspect-square bg-gray-100">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={entry.title || 'Artwork'}
                    fill
                    className="object-contain pointer-events-none select-none"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    draggable={false}
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
                    className="absolute top-4 right-4 text-base px-4 py-1 bg-red-600"
                  >
                    SOLD OUT
                  </Badge>
                )}
              </div>
            </Card>

            {/* 3D View Button */}
            <Link href={`/${galleryType}`} className="block">
              <Button variant="outline" className="w-full">
                3Dギャラリーで見る
              </Button>
            </Link>
          </div>

          {/* Info Section */}
          <div className="space-y-6">
            {/* Title & Artist */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {entry.title || 'Untitled'}
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                {entry.artist_name || 'Unknown Artist'}
              </p>
            </div>

            {/* Price & Edition */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {/* Price */}
                {entry.is_for_sale && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">価格</span>
                    <span className="text-xl font-bold text-[#00a1e9]">
                      {priceText || '価格未定'}
                    </span>
                  </div>
                )}

                {/* Edition */}
                {editionText && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">エディション</span>
                    <span className="font-medium">
                      残り {editionText} 点
                    </span>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">ステータス</span>
                  {sold ? (
                    <Badge variant="destructive">SOLD OUT</Badge>
                  ) : entry.is_for_sale ? (
                    <Badge className="bg-green-600">販売中</Badge>
                  ) : (
                    <Badge variant="secondary">展示のみ</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {entry.description && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  作品について
                </h2>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {entry.description}
                </p>
              </div>
            )}

            {/* SNS Links */}
            {Object.keys(snsLinks).length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  アーティストリンク
                </h2>
                <div className="flex flex-wrap gap-4">
                  {snsLinks.homepage && (
                    <a
                      href={snsLinks.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#00a1e9] hover:underline"
                    >
                      <Globe size={16} />
                      ホームページ
                    </a>
                  )}
                  {snsLinks.twitter && (
                    <a
                      href={snsLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#00a1e9] hover:underline"
                    >
                      <FaXTwitter />
                      X (Twitter)
                    </a>
                  )}
                  {snsLinks.instagram && (
                    <a
                      href={snsLinks.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#00a1e9] hover:underline"
                    >
                      <Instagram size={16} />
                      Instagram
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Gallery Info */}
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-400">
                展示場所:{' '}
                {galleryType === 'white' ? 'White Gallery' : 'Float Gallery'}
              </p>
            </div>
          </div>
        </div>

        {/* Comment Section */}
        <div id="comments" className="mt-8 scroll-mt-24">
          <CommentSection
            entryId={Number(id)}
            entryOwnerId={entry.user_id ?? undefined}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>
            <Link href="/float/2d" className="text-[#00a1e9] hover:underline">
              Float Gallery
            </Link>
            {' | '}
            <Link href="/white/2d" className="text-[#00a1e9] hover:underline">
              White Gallery
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
