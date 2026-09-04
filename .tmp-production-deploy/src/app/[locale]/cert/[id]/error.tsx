'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CertError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CoA route error]', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Server Error</h1>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              {error.message || 'An unexpected error occurred'}
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-gray-400 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex flex-col gap-3">
            <button
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
              ギャラリーに戻る
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
