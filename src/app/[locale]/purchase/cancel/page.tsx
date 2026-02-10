'use client';

import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="text-center py-20 px-4">
      <h1 className="text-2xl font-bold text-red-500">キャンセルされました</h1>
      <p className="mt-4 text-gray-700">購入手続きはキャンセルされました。</p>

      <Link
        href="/"
        className="inline-block mt-8 px-6 py-3 bg-[#00a1e9] text-white rounded-lg font-semibold text-sm hover:bg-[#008cc5] transition"
      >
        ホームページに戻る
      </Link>
    </div>
  );
}
