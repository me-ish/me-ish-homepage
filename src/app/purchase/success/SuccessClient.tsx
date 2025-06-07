// src/app/purchase/success/SuccessClient.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function SuccessClient() {
  const searchParams = useSearchParams();
  const entryId = searchParams.get('entryId');

  useEffect(() => {
    console.log('entryId:', entryId);
  }, [entryId]);

  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold text-green-600">ご購入ありがとうございます！</h1>
      <p className="mt-4">購入処理が完了しました。</p>

      <a
        href="/"
        className="inline-block mt-6 px-6 py-3 bg-[#00a1e9] text-white rounded-lg hover:bg-[#008ec4] transition"
      >
        ホームページに戻る
      </a>
    </div>
  );
}
