// src/app/mypage/_components/PortfolioPromotionCard.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ArrowRight,
  Link as LinkIcon,
  ExternalLink,
  Share2,
  Info,
} from 'lucide-react';

type Props = {
  /** /artists/{userId} の公開URL */
  publicUrl: string;
};

export function PortfolioPromotionCard({ publicUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const canUseUrl = !!publicUrl;

  const handleCopy = async () => {
    try {
      if (!publicUrl) return;
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setToast('公開URLをコピーしました');
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setToast('コピーに失敗しました');
    }
  };

  const handleShareX = () => {
    if (!publicUrl) return;
    const text = `me-ish ポートフォリオ\n${publicUrl}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&hashtags=me_ish`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 公開ページはURLが取れない場合でも仮で開ける（保険）
  const openHref = publicUrl || '/artists/me';

  return (
    <div className="space-y-2">
      <Card className="overflow-hidden bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-none shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* 上段：タイトル + CTA */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg">
                    ポートフォリオを公開しよう
                  </h3>

                  <p className="text-gray-600 text-sm mt-1">
                    あなたの応募作品が自動で反映される公開URLです。
                    <br className="hidden sm:block" />
                    SNSでシェアして、より多くの人にあなたの世界観を届けましょう。
                  </p>

                  {/* ✅ 追加：このボタンの意味を明確化 */}
                  <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      「公開内容を編集」では、下の公開ページに表示する
                      <span className="font-medium">作品の表示/非表示・並び順・公開/非公開</span>
                      を設定できます。
                    </p>
                  </div>
                </div>
              </div>

              {/* 右：設定ボタン（主導線） */}
              <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2">
                <Link href="/aura/form" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto rounded-full"
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-indigo-600" />
                    AURAでカスタム
                  </Button>
                </Link>

                <Link href="/mypage/portfolio" className="w-full sm:w-auto">
                  <Button
                    variant="default"
                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-full px-6"
                  >
                    公開内容を編集
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* 中段：公開URL + 操作 */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1 overflow-hidden rounded-xl border bg-white/70 px-3 py-2 text-sm text-gray-700">
                <span className="truncate">{publicUrl || '/artists/...'}</span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  disabled={!canUseUrl}
                  className="rounded-xl"
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  {copied ? 'コピー済み' : 'URLコピー'}
                </Button>

                <a href={openHref} target="_blank" rel="noreferrer">
                  <Button type="button" variant="outline" className="rounded-xl">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    公開ページ
                  </Button>
                </a>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShareX}
                  disabled={!canUseUrl}
                  className="rounded-xl"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  シェア
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {toast && <div className="text-xs text-gray-600">{toast}</div>}
    </div>
  );
}
