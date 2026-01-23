// src/app/mypage/_components/PortfolioPromotionCard.tsx
'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

export function PortfolioPromotionCard() {
  return (
    <Card className="overflow-hidden bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-none shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">
                ポートフォリオを公開しよう
              </h3>
              <p className="text-gray-600 text-sm mt-1">
                あなたの作品をまとめたオリジナルのポートフォリオページを作成できます。
                <br className="hidden sm:block" />
                SNSでシェアして、より多くの人にあなたの世界観を届けましょう。
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Link href="/mypage/portfolio">
              <Button
                variant="default"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-full px-6"
              >
                ポートフォリオ設定
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
