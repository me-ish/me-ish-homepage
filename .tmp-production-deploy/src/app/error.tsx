'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              エラーが発生しました
            </h1>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              申し訳ありません。予期しないエラーが発生しました。
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-gray-400 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div className="px-6 pb-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00a1e9] text-white text-sm font-medium transition-all hover:bg-[#0090d4] active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              再読み込み
            </button>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium transition-all hover:bg-gray-200"
            >
              <ArrowLeft className="w-4 h-4" />
              トップに戻る
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
